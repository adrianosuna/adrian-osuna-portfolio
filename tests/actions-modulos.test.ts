// Validaciones de las server actions restantes: pipeline de oportunidades
// (saneado de textos, whitelist de estados, límites de importe, ciclo de
// cierre/archivado, timeline) y conceptos del sistema de ahorro (extras y
// gastos de viaje, fechas malformadas).
import { beforeEach, describe, expect, it, vi } from 'vitest'
// El tope de peticiones vive en memoria y es COMPARTIDO por todo el proceso:
// sin reiniciarlo, un fichero de tests con muchas actions agotaría la ventana
// y los siguientes fallarían por algo que no están probando.
import { reiniciarLimites } from '@/lib/rate-limit'

const { requireAdminMock, prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    opportunity: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    opportunityEvent: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
    savingYear: { findUnique: vi.fn(), update: vi.fn() },
    savingExtra: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    travelExpense: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  }
  return { requireAdminMock: vi.fn(), prismaMock }
})

vi.mock('@/auth', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  reiniciarLimites()
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue({ user: { uuid: 'admin-1', role: 'ADMIN' } })
  prismaMock.savingYear.findUnique.mockResolvedValue(null)
})

// ─────────── Pipeline de oportunidades ───────────

describe('createOpportunity', () => {
  it('exige título (los espacios no cuentan)', async () => {
    const { createOpportunity } = await import('@/app/app/pipeline/actions')
    expect(await createOpportunity({ title: '   ' })).toEqual({ ok: false, message: 'El título es obligatorio' })
    expect(prismaMock.opportunity.create).not.toHaveBeenCalled()
  })

  it('sanea los textos: recorta, limita longitud y vacío → null', async () => {
    const { createOpportunity } = await import('@/app/app/pipeline/actions')
    await createOpportunity({ title: '  Oferta  ', company: '   ', origin: 'x'.repeat(500) })
    const data = prismaMock.opportunity.create.mock.calls[0][0].data
    expect(data.title).toBe('Oferta')
    expect(data.company).toBeNull()
    expect(data.origin).toHaveLength(100) // límite de la columna
  })

  it('un estado inventado desde un cliente manipulado cae al inicial', async () => {
    const { createOpportunity } = await import('@/app/app/pipeline/actions')
    await createOpportunity({ title: 'Oferta', status: 'GANADA_SEGURO' })
    expect(prismaMock.opportunity.create.mock.calls[0][0].data.status).toBe('CONTACTO')
  })

  it('la creación deja el primer apunte del historial (con qué estado nació)', async () => {
    const { createOpportunity } = await import('@/app/app/pipeline/actions')
    await createOpportunity({ title: 'Oferta', status: 'CONVERSACION' })
    expect(prismaMock.opportunity.create.mock.calls[0][0].data.events).toEqual({
      create: { type: 'ESTADO', detail: 'Creada en Conversación' },
    })
  })

  it('una fecha de seguimiento malformada queda en null; la válida, a medianoche UTC', async () => {
    const { createOpportunity } = await import('@/app/app/pipeline/actions')
    await createOpportunity({ title: 'Oferta', nextActionDate: '30/08/2026' })
    expect(prismaMock.opportunity.create.mock.calls[0][0].data.nextActionDate).toBeNull()

    await createOpportunity({ title: 'Oferta', nextActionDate: '2026-08-30' })
    const fecha = prismaMock.opportunity.create.mock.calls[1][0].data.nextActionDate as Date
    expect(fecha.toISOString()).toBe('2026-08-30T00:00:00.000Z')
  })

  it('rechaza importes negativos, no finitos o desorbitados', async () => {
    const { createOpportunity } = await import('@/app/app/pipeline/actions')
    // El mensaje lo pone `lib/esquemas.ts` y dice QUÉ pasa con el importe,
    // no solo que "no es válido": va tal cual al aviso del cliente.
    const mensajes: Array<[unknown, string]> = [
      [-1, 'El importe no puede ser negativo'],
      [Number.NaN, 'El importe no es válido'],
      [Number.POSITIVE_INFINITY, 'El importe no es válido'],
      [1e10, 'El importe es demasiado grande'],
    ]
    for (const [amount, message] of mensajes) {
      expect(await createOpportunity({ title: 'Oferta', amount: amount as number })).toEqual({
        ok: false,
        message,
      })
    }
    expect(prismaMock.opportunity.create).not.toHaveBeenCalled()
  })
})

describe('updateOpportunity', () => {
  it('rechaza mover a un estado fuera de la whitelist', async () => {
    const { updateOpportunity } = await import('@/app/app/pipeline/actions')
    expect(await updateOpportunity('op-1', { status: 'INVENTADO' })).toEqual({ ok: false, message: 'Estado no válido' })
    expect(prismaMock.opportunity.update).not.toHaveBeenCalled()
  })

  it('mover de estado escribe el estado y el apunte del historial', async () => {
    const { updateOpportunity } = await import('@/app/app/pipeline/actions')
    prismaMock.opportunity.findUnique.mockResolvedValue({ status: 'CONVERSACION' })
    expect(await updateOpportunity('op-1', { status: 'PROPUESTA' })).toEqual({ ok: true })
    expect(prismaMock.opportunity.update).toHaveBeenCalledWith({
      where: { uuid: 'op-1' },
      data: {
        status: 'PROPUESTA',
        events: { create: { type: 'ESTADO', detail: 'Conversación → Propuesta' } },
      },
    })
  })

  it('mover al estado en el que ya está no hace nada', async () => {
    const { updateOpportunity } = await import('@/app/app/pipeline/actions')
    prismaMock.opportunity.findUnique.mockResolvedValue({ status: 'PROPUESTA' })
    expect(await updateOpportunity('op-1', { status: 'PROPUESTA' })).toEqual({ ok: false, message: 'Nada que actualizar' })
    expect(prismaMock.opportunity.update).not.toHaveBeenCalled()
  })

  it('cerrar sella la fecha de cierre y retira el seguimiento pendiente', async () => {
    const { updateOpportunity } = await import('@/app/app/pipeline/actions')
    prismaMock.opportunity.findUnique.mockResolvedValue({ status: 'PROPUESTA' })
    await updateOpportunity('op-1', { status: 'CERRADO' })
    const data = prismaMock.opportunity.update.mock.calls[0][0].data
    expect(data.closedAt).toBeInstanceOf(Date)
    expect(data.nextAction).toBeNull()
    expect(data.nextActionDate).toBeNull()
    expect(data.nextActionNotified).toBeNull()
  })

  it('reabrir una terminada limpia el cierre y la desarchiva', async () => {
    const { updateOpportunity } = await import('@/app/app/pipeline/actions')
    prismaMock.opportunity.findUnique.mockResolvedValue({ status: 'DESCARTADO' })
    await updateOpportunity('op-1', { status: 'CONVERSACION' })
    const data = prismaMock.opportunity.update.mock.calls[0][0].data
    expect(data.closedAt).toBeNull()
    expect(data.archived).toBe(false)
  })

  it('cambiar la fecha de seguimiento reinicia el ciclo de avisos', async () => {
    const { updateOpportunity } = await import('@/app/app/pipeline/actions')
    await updateOpportunity('op-1', { nextActionDate: '2026-09-15' })
    const data = prismaMock.opportunity.update.mock.calls[0][0].data
    expect((data.nextActionDate as Date).toISOString()).toBe('2026-09-15T00:00:00.000Z')
    expect(data.nextActionNotified).toBeNull()
  })

  it('sin cambios no toca la BD', async () => {
    const { updateOpportunity } = await import('@/app/app/pipeline/actions')
    expect(await updateOpportunity('op-1', {})).toEqual({ ok: false, message: 'Nada que actualizar' })
  })
})

describe('archiveOpportunity', () => {
  it('solo se archivan oportunidades terminadas (cerradas o descartadas)', async () => {
    const { archiveOpportunity } = await import('@/app/app/pipeline/actions')
    prismaMock.opportunity.findUnique.mockResolvedValue({ status: 'PROPUESTA' })
    expect(await archiveOpportunity('op-1', true)).toEqual({
      ok: false, message: 'Solo se archivan oportunidades cerradas o descartadas',
    })

    prismaMock.opportunity.findUnique.mockResolvedValue({ status: 'CERRADO' })
    expect(await archiveOpportunity('op-1', true)).toEqual({ ok: true })
    expect(prismaMock.opportunity.update).toHaveBeenCalledWith({
      where: { uuid: 'op-1' },
      data: { archived: true },
    })
  })

  it('restaurar no exige comprobar el estado', async () => {
    const { archiveOpportunity } = await import('@/app/app/pipeline/actions')
    expect(await archiveOpportunity('op-1', false)).toEqual({ ok: true })
    expect(prismaMock.opportunity.findUnique).not.toHaveBeenCalled()
  })
})

describe('timeline de actividad', () => {
  it('rechaza tipos fuera de la whitelist manual (ESTADO lo escribe el sistema)', async () => {
    const { addOpportunityEvent } = await import('@/app/app/pipeline/actions')
    expect(await addOpportunityEvent('op-1', { type: 'ESTADO', detail: 'x' })).toEqual({
      ok: false, message: 'Tipo de actividad no válido',
    })
    expect(await addOpportunityEvent('op-1', { type: 'LLAMADA', detail: '  ' })).toEqual({
      ok: false, message: 'El detalle es obligatorio',
    })
    expect(prismaMock.opportunity.update).not.toHaveBeenCalled()
  })

  it('añade la entrada recortada vía update (refresca update_ts de la tarjeta)', async () => {
    const { addOpportunityEvent } = await import('@/app/app/pipeline/actions')
    expect(await addOpportunityEvent('op-1', { type: 'LLAMADA', detail: '  Les llamé  ' })).toEqual({ ok: true })
    expect(prismaMock.opportunity.update).toHaveBeenCalledWith({
      where: { uuid: 'op-1' },
      data: { events: { create: { type: 'LLAMADA', detail: 'Les llamé' } } },
    })
  })

  it('los apuntes de estado no se pueden borrar; los manuales sí', async () => {
    const { deleteOpportunityEvent } = await import('@/app/app/pipeline/actions')
    prismaMock.opportunityEvent.findUnique.mockResolvedValue({ type: 'ESTADO' })
    expect(await deleteOpportunityEvent('ev-1')).toEqual({
      ok: false, message: 'El historial de estados no se puede borrar',
    })
    expect(prismaMock.opportunityEvent.delete).not.toHaveBeenCalled()

    prismaMock.opportunityEvent.findUnique.mockResolvedValue({ type: 'NOTA' })
    expect(await deleteOpportunityEvent('ev-1')).toEqual({ ok: true })
    expect(prismaMock.opportunityEvent.delete).toHaveBeenCalledWith({ where: { uuid: 'ev-1' } })
  })
})

// ─────────── Conceptos del ahorro: extras y gastos de viaje ───────────

describe('addExtra / addTravel', () => {
  it('el concepto es obligatorio y el importe no admite negativos', async () => {
    const { addExtra } = await import('@/app/app/finance/actions')
    expect(await addExtra('y26', { concept: '  ', amount: 100 })).toEqual({ ok: false, message: 'El concepto es obligatorio' })
    expect(await addExtra('y26', { concept: 'Paga extra', amount: -5 })).toEqual({
      ok: false,
      message: 'El importe no puede ser negativo',
    })
    expect(prismaMock.savingExtra.create).not.toHaveBeenCalled()
  })

  it('crea el extra con el concepto recortado', async () => {
    const { addExtra } = await import('@/app/app/finance/actions')
    expect(await addExtra('y26', { concept: ' Bonus ', amount: 500 })).toEqual({ ok: true })
    expect(prismaMock.savingExtra.create).toHaveBeenCalledWith({
      data: { yearUuid: 'y26', concept: 'Bonus', amount: 500 },
    })
  })

  it('crea el gasto de viaje con concepto recortado e importe (sin fecha: se retiró)', async () => {
    const { addTravel } = await import('@/app/app/finance/actions')
    expect(await addTravel('y26', { concept: '  Vuelos ', amount: 300 })).toEqual({ ok: true })
    expect(prismaMock.travelExpense.create).toHaveBeenCalledWith({
      data: { yearUuid: 'y26', concept: 'Vuelos', amount: 300 },
    })
  })
})

describe('updateYear', () => {
  it('rechaza cambiar a un año que ya usa OTRO registro (pero permite el propio)', async () => {
    const { updateYear } = await import('@/app/app/finance/actions')
    prismaMock.savingYear.findUnique.mockResolvedValue({ uuid: 'otro-registro' })
    expect(await updateYear('mi-uuid', { year: 2026 })).toEqual({ ok: false, message: 'Ese año ya existe' })

    prismaMock.savingYear.findUnique.mockResolvedValue({ uuid: 'mi-uuid' })
    expect(await updateYear('mi-uuid', { year: 2026 })).toEqual({ ok: true })
  })

  it('un objetivo no positivo se guarda como null (sin objetivo)', async () => {
    const { updateYear } = await import('@/app/app/finance/actions')
    await updateYear('mi-uuid', { goal: 0 })
    expect(prismaMock.savingYear.update).toHaveBeenCalledWith({
      where: { uuid: 'mi-uuid' },
      data: { goal: null },
    })
  })
})

// ─────────── Posponer el seguimiento ───────────
//
// Es lo que más se hace con un seguimiento vencido («esta semana no, la que
// viene»), y hasta ahora había que abrir la ficha y elegir día en el
// calendario: el gesto más frecuente con el camino más largo.
describe('snoozeSeguimiento', () => {
  const conSeguimiento = (extra: Record<string, unknown> = {}) => {
    prismaMock.opportunity.findUnique.mockResolvedValue({
      nextActionDate: new Date('2026-08-20T00:00:00Z'),
      nextAction: 'Enviar la propuesta',
      status: 'PROPUESTA',
      archived: false,
      ...extra,
    })
  }

  it('⚠ cuenta desde HOY, no desde la fecha que tenía', async () => {
    // Un seguimiento vencido hace tres semanas, sumándole 7 días a su propia
    // fecha, seguiría vencido: se pospone y no pasa nada, que es lo contrario
    // de lo que se pedía.
    conSeguimiento()
    const { snoozeSeguimiento } = await import('@/app/app/pipeline/actions')
    expect(await snoozeSeguimiento('op-1', 7)).toEqual({ ok: true })
    const nueva = prismaMock.opportunity.update.mock.calls[0][0].data.nextActionDate as Date
    const dias = (nueva.getTime() - Date.now()) / 86_400_000
    expect(dias).toBeGreaterThan(6)
    expect(dias).toBeLessThan(7.5)
  })

  it('reinicia el aviso por correo y deja apunte en el timeline', async () => {
    conSeguimiento()
    const { snoozeSeguimiento } = await import('@/app/app/pipeline/actions')
    await snoozeSeguimiento('op-1', 7)
    const data = prismaMock.opportunity.update.mock.calls[0][0].data
    // Si vuelve a vencer, tiene que volver a avisar.
    expect(data.nextActionNotified).toBeNull()
    // Sin rastro no hay forma de ver que algo lleva un mes aplazándose semana
    // a semana, que es la señal de que hay que cerrarlo o descartarlo.
    expect(data.events.create.type).toBe('NOTA')
    expect(data.events.create.detail).toMatch(/Seguimiento aplazado 7 días, al \d{2}\/\d{2}\/\d{4}/)
  })

  it('el singular del apunte concuerda', async () => {
    conSeguimiento()
    const { snoozeSeguimiento } = await import('@/app/app/pipeline/actions')
    await snoozeSeguimiento('op-1', 1)
    expect(prismaMock.opportunity.update.mock.calls[0][0].data.events.create.detail).toContain(
      'aplazado 1 día,',
    )
  })

  it('sin seguimiento no hay nada que posponer', async () => {
    // Crear la fecha aquí sería inventarse una próxima acción que nadie
    // ha escrito.
    conSeguimiento({ nextActionDate: null })
    const { snoozeSeguimiento } = await import('@/app/app/pipeline/actions')
    const res = await snoozeSeguimiento('op-1', 7)
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/no tiene seguimiento/)
    expect(prismaMock.opportunity.update).not.toHaveBeenCalled()
  })

  it('una archivada tampoco: su seguimiento ya no está activo', async () => {
    conSeguimiento({ archived: true })
    const { snoozeSeguimiento } = await import('@/app/app/pipeline/actions')
    expect((await snoozeSeguimiento('op-1', 7)).ok).toBe(false)
    expect(prismaMock.opportunity.update).not.toHaveBeenCalled()
  })

  it('rechaza días fuera de 1-90 y sin tocar la BD', async () => {
    const { snoozeSeguimiento } = await import('@/app/app/pipeline/actions')
    for (const d of [0, -7, 91, 1.5]) {
      const res = await snoozeSeguimiento('op-1', d)
      expect(res.ok).toBe(false)
      expect(res.message).toMatch(/1 a 90/)
    }
    expect(prismaMock.opportunity.findUnique).not.toHaveBeenCalled()
  })

  it('una oportunidad que no existe se rechaza', async () => {
    prismaMock.opportunity.findUnique.mockResolvedValue(null)
    const { snoozeSeguimiento } = await import('@/app/app/pipeline/actions')
    expect(await snoozeSeguimiento('fantasma', 7)).toEqual({
      ok: false, message: 'Oportunidad no encontrada',
    })
  })
})
