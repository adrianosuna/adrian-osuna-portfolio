// Recordatorio de meses de ahorro sin rellenar (lo dispara el cron diario):
// qué cuenta como mes vacío, el mes natural anterior (con cruce de año) y el
// envío por correo con freno semanal vía last_reminded.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, correoMock } = vi.hoisted(() => ({
  prismaMock: { savingYear: { findUnique: vi.fn(), update: vi.fn() } },
  correoMock: {
    correoConfigurado: vi.fn(),
    enviarCorreo: vi.fn(),
    tarjetaHtml: vi.fn((titulo: string, detalle: string) => `[${titulo}|${detalle}]`),
    botonHtml: vi.fn(() => '[boton]'),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/correo', () => correoMock)
vi.mock('@/lib/site', () => ({ SITE_URL: 'https://adrianosuna.com' }))

const { avisarMesSinRellenar, mesAnterior, mesesSinRellenar } = await import('@/lib/finance')

const mes = (month: number, valores: Partial<{ income: number; savingGeneral: number; savingTravel: number }> = {}) => ({
  month,
  income: valores.income ?? null,
  savingGeneral: valores.savingGeneral ?? null,
  savingTravel: valores.savingTravel ?? null,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('mesAnterior', () => {
  it('mes anterior dentro del mismo año', () => {
    expect(mesAnterior('2026-08-26')).toEqual({ year: 2026, month: 7 })
  })

  it('en enero cruza al diciembre del año anterior', () => {
    expect(mesAnterior('2027-01-05')).toEqual({ year: 2026, month: 12 })
  })
})

describe('mesesSinRellenar', () => {
  it('los meses sin fila cuentan como vacíos, y solo mira hasta el límite', () => {
    expect(mesesSinRellenar([mes(1, { income: 2000 })], 3)).toEqual([2, 3])
  })

  it('una fila con los tres campos a null es un mes vacío; con algún dato (aunque sea 0) no', () => {
    expect(mesesSinRellenar([mes(1), mes(2, { savingGeneral: 0 })], 2)).toEqual([1])
  })
})

describe('avisarMesSinRellenar', () => {
  it('sin SMTP configurado no toca la BD', async () => {
    correoMock.correoConfigurado.mockReturnValue(false)
    expect(await avisarMesSinRellenar('2026-08-26')).toBe(0)
    expect(prismaMock.savingYear.findUnique).not.toHaveBeenCalled()
  })

  it('sin registro del año (o con todo relleno) no envía nada', async () => {
    correoMock.correoConfigurado.mockReturnValue(true)
    prismaMock.savingYear.findUnique.mockResolvedValue(null)
    expect(await avisarMesSinRellenar('2026-08-26')).toBe(0)

    prismaMock.savingYear.findUnique.mockResolvedValue({
      uuid: 'y26', lastReminded: null,
      months: Array.from({ length: 7 }, (_, i) => mes(i + 1, { savingGeneral: 500 })),
    })
    expect(await avisarMesSinRellenar('2026-08-26')).toBe(0)
    expect(correoMock.enviarCorreo).not.toHaveBeenCalled()
  })

  it('con meses vacíos envía el correo con sus nombres y marca last_reminded', async () => {
    correoMock.correoConfigurado.mockReturnValue(true)
    prismaMock.savingYear.findUnique.mockResolvedValue({
      uuid: 'y26', lastReminded: null,
      months: Array.from({ length: 5 }, (_, i) => mes(i + 1, { savingGeneral: 500 })), // jun-jul vacíos
    })
    prismaMock.savingYear.update.mockResolvedValue({})

    expect(await avisarMesSinRellenar('2026-08-26')).toBe(2)
    expect(prismaMock.savingYear.findUnique.mock.calls[0][0].where).toEqual({ year: 2026 })
    expect(correoMock.enviarCorreo.mock.calls[0][0]).toContain('2 meses sin rellenar')
    expect(correoMock.tarjetaHtml).toHaveBeenCalledWith(
      'Ahorro 2026', 'Sin rellenar: Junio, Julio', null, true,
    )
    expect(prismaMock.savingYear.update).toHaveBeenCalledWith({
      where: { uuid: 'y26' },
      data: { lastReminded: expect.any(Date) },
    })
  })

  it('reaviso semanal: con un last_reminded reciente se calla', async () => {
    correoMock.correoConfigurado.mockReturnValue(true)
    prismaMock.savingYear.findUnique.mockResolvedValue({
      uuid: 'y26', lastReminded: new Date(Date.now() - 2 * 86_400_000), months: [],
    })
    expect(await avisarMesSinRellenar('2026-08-26')).toBe(0)
    expect(correoMock.enviarCorreo).not.toHaveBeenCalled()
  })

  it('en enero revisa el año anterior completo (hasta diciembre)', async () => {
    correoMock.correoConfigurado.mockReturnValue(true)
    prismaMock.savingYear.findUnique.mockResolvedValue({
      uuid: 'y26', lastReminded: null,
      months: Array.from({ length: 11 }, (_, i) => mes(i + 1, { savingGeneral: 500 })), // diciembre vacío
    })
    prismaMock.savingYear.update.mockResolvedValue({})

    expect(await avisarMesSinRellenar('2027-01-05')).toBe(1)
    expect(prismaMock.savingYear.findUnique.mock.calls[0][0].where).toEqual({ year: 2026 })
    expect(correoMock.tarjetaHtml).toHaveBeenCalledWith(
      'Ahorro 2026', 'Sin rellenar: Diciembre', null, false,
    )
  })
})
