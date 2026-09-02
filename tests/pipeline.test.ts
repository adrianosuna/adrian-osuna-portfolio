// Lógica del pipeline: métricas del embudo (valor abierto, tasa de cierre,
// días hasta el cierre) y el aviso por correo de seguimientos vencidos que
// dispara el cron (filtro, contenido y marcado del reaviso semanal).
import { beforeEach, describe, expect, it, vi } from 'vitest'
// El tope de peticiones vive en memoria y es COMPARTIDO por todo el proceso:
// sin reiniciarlo, un fichero de tests con muchas actions agotaría la ventana
// y los siguientes fallarían por algo que no están probando.
import { reiniciarLimites } from '@/lib/rate-limit'

const { prismaMock, correoMock } = vi.hoisted(() => ({
  prismaMock: { opportunity: { findMany: vi.fn(), updateMany: vi.fn() } },
  correoMock: {
    correoConfigurado: vi.fn(),
    enviarCorreo: vi.fn(),
    tarjetaHtml: vi.fn(
      (titulo: string, detalle: string, nota: string | null, grave: boolean) =>
        `[${titulo}|${detalle}|${nota ?? ''}|${grave}]`,
    ),
    botonHtml: vi.fn(() => '[boton]'),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/correo', () => correoMock)
vi.mock('@/lib/site', () => ({ SITE_URL: 'https://adrianosuna.com' }))

const { metricasPipeline, avisarSeguimientos } = await import('@/lib/pipeline')

beforeEach(() => {
  reiniciarLimites()
  vi.clearAllMocks()
  vi.useRealTimers()
})

// ─────────── Métricas del embudo ───────────

const fila = (status: string, extra: Partial<{ amount: number | null; createTs: Date; closedAt: Date | null }> = {}) => ({
  status,
  amount: extra.amount ?? null,
  createTs: extra.createTs ?? new Date('2026-08-01T00:00:00Z'),
  closedAt: extra.closedAt ?? null,
})

describe('metricasPipeline', () => {
  it('sin datos: cero abiertas y sin tasas (null, no NaN)', () => {
    expect(metricasPipeline([])).toEqual({
      abiertas: 0, valorAbierto: 0, tasaCierre: null, diasMedioCierre: null,
    })
  })

  it('el valor abierto solo suma las vivas (los importes de cerradas no cuentan)', () => {
    const m = metricasPipeline([
      fila('CONTACTO', { amount: 1000 }),
      fila('PROPUESTA', { amount: 500 }),
      fila('PROPUESTA', { amount: null }), // sin importe: suma 0, pero cuenta
      fila('CERRADO', { amount: 9999 }),
    ])
    expect(m.abiertas).toBe(3)
    expect(m.valorAbierto).toBe(1500)
  })

  it('tasa de cierre = cerradas sobre terminadas', () => {
    const m = metricasPipeline([
      fila('CERRADO'), fila('CERRADO'), fila('DESCARTADO'), fila('CONTACTO'),
    ])
    expect(m.tasaCierre).toBe(67) // 2 de 3 terminadas
  })

  it('días medios de cierre: media de creación → closed_at, solo cerradas con fecha', () => {
    const m = metricasPipeline([
      fila('CERRADO', { createTs: new Date('2026-08-01T00:00:00Z'), closedAt: new Date('2026-08-11T00:00:00Z') }), // 10 días
      fila('CERRADO', { createTs: new Date('2026-08-01T00:00:00Z'), closedAt: new Date('2026-08-21T00:00:00Z') }), // 20 días
      fila('CERRADO'), // sin closed_at (dato viejo): fuera de la media
      fila('DESCARTADO', { createTs: new Date('2026-01-01T00:00:00Z'), closedAt: new Date('2026-08-01T00:00:00Z') }), // descartada: no es cierre
    ])
    expect(m.diasMedioCierre).toBe(15)
  })
})

// ─────────── Aviso de seguimientos vencidos ───────────

describe('avisarSeguimientos', () => {
  it('sin SMTP configurado no toca la BD', async () => {
    correoMock.correoConfigurado.mockReturnValue(false)
    expect(await avisarSeguimientos()).toBe(0)
    expect(prismaMock.opportunity.findMany).not.toHaveBeenCalled()
  })

  it('sin vencidas no envía nada', async () => {
    correoMock.correoConfigurado.mockReturnValue(true)
    prismaMock.opportunity.findMany.mockResolvedValue([])
    expect(await avisarSeguimientos()).toBe(0)
    expect(correoMock.enviarCorreo).not.toHaveBeenCalled()
  })

  it('el filtro pide solo vivas sin archivar y respeta el freno semanal', async () => {
    correoMock.correoConfigurado.mockReturnValue(true)
    prismaMock.opportunity.findMany.mockResolvedValue([])
    await avisarSeguimientos()
    const where = prismaMock.opportunity.findMany.mock.calls[0][0].where
    expect(where.archived).toBe(false)
    expect(where.status).toEqual({ in: ['CONTACTO', 'CONVERSACION', 'PROPUESTA'] })
    expect(where.nextActionDate.lte).toBeInstanceOf(Date)
    expect(where.OR[0]).toEqual({ nextActionNotified: null })
    expect(where.OR[1].nextActionNotified.lte).toBeInstanceOf(Date)
  })

  it('envía el correo con una tarjeta por oportunidad (grave a la semana) y marca el aviso', async () => {
    correoMock.correoConfigurado.mockReturnValue(true)
    // Solo se falsea Date (no los timers): las promesas siguen resolviendo.
    vi.useFakeTimers({ now: new Date('2026-08-26T10:00:00Z'), toFake: ['Date'] })
    prismaMock.opportunity.findMany.mockResolvedValue([
      {
        uuid: 'op-1', title: 'Encargo web', company: 'Acme',
        nextAction: 'Enviar propuesta', nextActionDate: new Date('2026-08-10T00:00:00Z'),
      },
      {
        uuid: 'op-2', title: 'Oferta', company: null,
        nextAction: null, nextActionDate: new Date('2026-08-26T00:00:00Z'),
      },
    ])
    prismaMock.opportunity.updateMany.mockResolvedValue({ count: 2 })

    expect(await avisarSeguimientos()).toBe(2)

    // Retraso de 16 días → grave; el de hoy → no.
    expect(correoMock.tarjetaHtml).toHaveBeenNthCalledWith(
      1, 'Encargo web · Acme', 'Seguimiento previsto el 10/08/2026 — hace 16 días', 'Enviar propuesta', true,
    )
    expect(correoMock.tarjetaHtml).toHaveBeenNthCalledWith(
      2, 'Oferta', 'Seguimiento previsto el 26/08/2026 — hoy', null, false,
    )
    expect(correoMock.enviarCorreo.mock.calls[0][0]).toContain('2 seguimientos pendientes')

    expect(prismaMock.opportunity.updateMany).toHaveBeenCalledWith({
      where: { uuid: { in: ['op-1', 'op-2'] } },
      data: { nextActionNotified: expect.any(Date) },
    })
  })
})

// ─────────── cuandoSeguimiento (texto corto del chip de la tarjeta) ───────────

const { cuandoSeguimiento } = await import('@/components/dashboard/pipeline/comun')

describe('cuandoSeguimiento', () => {
  const hoy = '2026-08-27'

  it('vencidos: ayer y hace N días', () => {
    expect(cuandoSeguimiento('2026-08-26', hoy)).toBe('venció ayer')
    expect(cuandoSeguimiento('2026-08-23', hoy)).toBe('venció hace 4 días')
  })

  it('hoy y mañana tienen su propio texto', () => {
    expect(cuandoSeguimiento('2026-08-27', hoy)).toBe('vence hoy')
    expect(cuandoSeguimiento('2026-08-28', hoy)).toBe('vence mañana')
  })

  it('dentro de dos semanas cuenta los días; más lejos, la fecha', () => {
    expect(cuandoSeguimiento('2026-09-03', hoy)).toBe('vence en 7 días')
    expect(cuandoSeguimiento('2026-09-10', hoy)).toBe('vence en 14 días')
    expect(cuandoSeguimiento('2026-09-11', hoy)).toBe('vence el 11/09/2026')
  })

  it('cruza el cambio de mes sin desviarse', () => {
    expect(cuandoSeguimiento('2026-09-01', '2026-08-31')).toBe('vence mañana')
    expect(cuandoSeguimiento('2026-08-31', '2026-09-01')).toBe('venció ayer')
  })
})
