// Proyección a 12 meses del calendario de mantenimiento. Se prueba aparte
// porque la aritmética de meses es justo donde esto se rompe: meses cortos,
// cruce de año y tareas ya vencidas antes de la ventana.
import { describe, expect, it, vi } from 'vitest'

// El componente importa sus server actions, que arrastran Prisma y el correo:
// aquí solo interesa la función pura de proyección.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/auth', () => ({ requireAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { proximosMeses, periodicidad } = await import('@/components/dashboard/panel/mantenimiento')
type MaintenanceRow = import('@/components/dashboard/panel/mantenimiento').MaintenanceRow

const tarea = (over: Partial<MaintenanceRow> = {}): MaintenanceRow => ({
  uuid: 't-1',
  title: 'ITV',
  scopeUuid: 'a-1',
  scopeName: 'Vehículo',
  notes: null,
  intervalMonths: 12,
  nextDue: '2026-09-20',
  lastDone: null,
  ...over,
})

/** Meses que traen algo, como 'YYYY-MM'. */
const conTareas = (meses: ReturnType<typeof proximosMeses>) =>
  meses.filter((m) => m.tareas.length > 0).map((m) => m.mes)

describe('proximosMeses', () => {
  it('devuelve siempre la ventana completa, empezando por el mes en curso', () => {
    const meses = proximosMeses([], '2026-09-02')
    expect(meses).toHaveLength(12)
    expect(meses[0].mes).toBe('2026-09')
    expect(meses[11].mes).toBe('2027-08')
    // Los meses vacíos también salen: un hueco es información.
    expect(meses.every((m) => m.tareas.length === 0)).toBe(true)
  })

  it('una tarea anual aparece una sola vez, en su mes', () => {
    const meses = proximosMeses([tarea()], '2026-09-02')
    expect(conTareas(meses)).toEqual(['2026-09'])
    expect(meses[0].tareas[0]).toMatchObject({ title: 'ITV', fecha: '2026-09-20', atrasada: false })
  })

  it('una tarea mensual cae en los doce meses', () => {
    const meses = proximosMeses([tarea({ intervalMonths: 1, nextDue: '2026-09-10' })], '2026-09-02')
    expect(conTareas(meses)).toHaveLength(12)
    // Cruce de año incluido.
    expect(meses[4].tareas[0].fecha).toBe('2027-01-10')
  })

  it('recorta al último día en los meses cortos', () => {
    // Un vencimiento del 31 pasando por meses de 30 días.
    const meses = proximosMeses([tarea({ intervalMonths: 1, nextDue: '2026-10-31' })], '2026-10-01')
    const fechas = meses.flatMap((m) => m.tareas.map((t) => t.fecha))
    expect(fechas).toContain('2026-10-31')
    expect(fechas).toContain('2026-11-30') // noviembre tiene 30
    expect(fechas).toContain('2027-02-28') // 2027 no es bisiesto
  })

  it('lo ya vencido antes de la ventana se muestra en el mes en curso, marcado', () => {
    const meses = proximosMeses([tarea({ intervalMonths: 12, nextDue: '2026-03-05' })], '2026-09-02')
    const primera = meses[0].tareas[0]
    expect(primera.atrasada).toBe(true)
    // Con su fecha REAL, no la de hoy: es lo que dice cuánto se lleva de retraso.
    expect(primera.fecha).toBe('2026-03-05')
  })

  it('una vencida mensual sale en el mes en curso atrasada y además en su serie', () => {
    const meses = proximosMeses([tarea({ intervalMonths: 1, nextDue: '2026-07-15' })], '2026-09-02')
    const septiembre = meses[0].tareas
    // La atrasada (julio) y el vencimiento propio de septiembre.
    expect(septiembre.some((t) => t.atrasada && t.fecha === '2026-07-15')).toBe(true)
    expect(septiembre.some((t) => !t.atrasada && t.fecha === '2026-09-15')).toBe(true)
  })

  it('ordena por fecha dentro de cada mes', () => {
    const meses = proximosMeses(
      [
        tarea({ uuid: 'a', title: 'Tarde', nextDue: '2026-09-25', intervalMonths: 12 }),
        tarea({ uuid: 'b', title: 'Pronto', nextDue: '2026-09-05', intervalMonths: 12 }),
      ],
      '2026-09-02',
    )
    expect(meses[0].tareas.map((t) => t.title)).toEqual(['Pronto', 'Tarde'])
  })

  it('un intervalo corrupto (0) no cuelga el bucle', () => {
    // La periodicidad se valida en la action, pero una fila vieja no debe
    // colgar la vista: el paso mínimo es un mes.
    const meses = proximosMeses([tarea({ intervalMonths: 0, nextDue: '2026-09-10' })], '2026-09-02')
    expect(meses).toHaveLength(12)
    expect(conTareas(meses)).toHaveLength(12)
  })

  it('respeta una ventana distinta de 12', () => {
    const meses = proximosMeses([], '2026-12-15', 3)
    expect(meses.map((m) => m.mes)).toEqual(['2026-12', '2027-01', '2027-02'])
  })
})

describe('recordatorios puntuales (sin periodicidad)', () => {
  it('sale UNA vez, en su mes, y no encadena serie', () => {
    const meses = proximosMeses(
      [tarea({ uuid: 'r', title: 'Renovar dominio', intervalMonths: null, nextDue: '2026-11-12' })],
      '2026-09-15',
      12,
    )
    const conEl = meses.filter((m) => m.tareas.some((o) => o.uuid === 'r'))
    expect(conEl).toHaveLength(1)
    expect(conEl[0].mes).toBe('2026-11')
  })

  it('si ya se pasó, sale en el mes en curso marcado como atrasado', () => {
    const meses = proximosMeses(
      [tarea({ uuid: 'r', intervalMonths: null, nextDue: '2026-06-01' })],
      '2026-09-15',
      12,
    )
    const enCurso = meses[0].tareas.filter((o) => o.uuid === 'r')
    expect(enCurso).toHaveLength(1)
    expect(enCurso[0].atrasada).toBe(true)
    // Y en ningún otro mes: no hay repetición.
    expect(meses.slice(1).some((m) => m.tareas.some((o) => o.uuid === 'r'))).toBe(false)
  })

  it('uno con fecha más allá de la ventana no se cuela', () => {
    const meses = proximosMeses(
      [tarea({ uuid: 'r', intervalMonths: null, nextDue: '2028-01-01' })],
      '2026-09-15',
      12,
    )
    expect(meses.some((m) => m.tareas.some((o) => o.uuid === 'r'))).toBe(false)
  })

  it('«Una vez» es como se nombra su periodicidad', () => {
    expect(periodicidad(null)).toBe('Una vez')
    expect(periodicidad(12)).toBe('Anual')
  })
})
