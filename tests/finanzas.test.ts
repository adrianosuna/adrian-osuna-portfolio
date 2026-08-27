// Semántica del sistema de ahorro anual:
// - Ahorro anual = ahorro general mensual + ingresos extra + SOBRANTE de
//   viajes (ahorrado - gastado): lo no gastado se suma al cierre del año y
//   los viajes del año siguiente empiezan de cero.
// (El capital inicial/final se retiró el 26/08/2026: solo se controla el ahorro.)
import { describe, expect, it, vi } from 'vitest'

// finance.ts arrastra Prisma (abre conexión al cargarse) y el correo: aquí
// solo se prueban las fórmulas puras, así que se sustituyen por stubs.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/correo', () => ({ correoConfigurado: () => false, enviarCorreo: vi.fn(), tarjetaHtml: vi.fn(), botonHtml: vi.fn() }))
vi.mock('@/lib/site', () => ({ SITE_URL: 'https://adrianosuna.com' }))

const { ahorroAnualDe } = await import('@/lib/finance')
type YearSummary = import('@/lib/finance').YearSummary

const año = (parcial: Partial<YearSummary> = {}): YearSummary => ({
  uuid: 'y-1',
  year: 2026,
  goal: null,
  incomeTotal: 26_000,
  monthsGeneral: 6_000,
  monthsTravel: 1_200,
  extrasTotal: 1_500,
  travelsTotal: 900,
  generalPorMes: Array.from({ length: 12 }, () => 500),
  ...parcial,
})

describe('ahorroAnualDe', () => {
  it('suma mensual + extras + sobrante de viajes', () => {
    // 6.000 + 1.500 + (1.200 - 900) = 7.800
    expect(ahorroAnualDe(año())).toBe(7_800)
  })

  it('viajes gastado = ahorrado no aporta nada (sobrante cero)', () => {
    expect(ahorroAnualDe(año({ monthsTravel: 500, travelsTotal: 500 }))).toBe(7_500)
  })

  it('gastar en viajes más de lo ahorrado RESTA (el exceso sale del ahorro)', () => {
    expect(ahorroAnualDe(año({ monthsTravel: 500, travelsTotal: 800 }))).toBe(7_200)
  })

  it('un año vacío ahorra cero', () => {
    expect(ahorroAnualDe(año({ monthsGeneral: 0, extrasTotal: 0, monthsTravel: 0, travelsTotal: 0 }))).toBe(0)
  })
})

// ─────────── Fórmulas de comun.tsx (asistente y tasa de ahorro) ───────────

const { proyeccionDe, esperadoHoy, tasaAhorroDe, pct } = await import('@/components/dashboard/savings/comun')

describe('tasaAhorroDe', () => {
  it('tasa = ahorro anual (con sobrante) entre TODO lo ingresado', () => {
    // 7.800 / (26.000 + 1.500 de extras) = 0,2836
    expect(tasaAhorroDe(año())).toBeCloseTo(7_800 / 27_500, 6)
    expect(pct(tasaAhorroDe(año()))).toBe('28 %')
  })

  it('los extras cuentan también como ingresos: la tasa no pasa del 100%', () => {
    // Un año en que TODO lo ingresado se ahorra: nómina 1.000 + extra 9.000,
    // ahorro 10.000 → 100%, nunca más (antes daba 1.000%).
    const limite = año({
      incomeTotal: 1_000, monthsGeneral: 1_000, extrasTotal: 9_000,
      monthsTravel: 0, travelsTotal: 0,
    })
    expect(pct(tasaAhorroDe(limite))).toBe('100 %')
  })

  it('sin ingresos no hay tasa (null, no división por cero)', () => {
    expect(tasaAhorroDe(año({ incomeTotal: 0, extrasTotal: 0 }))).toBeNull()
    expect(pct(null)).toBe('—')
  })
})

describe('formato de porcentaje', () => {
  // La app escribe el porcentaje con espacio (norma RAE) y ese espacio es
  // IRROMPIBLE: la cifra y el símbolo nunca se separan al final de una línea.
  it('lleva espacio entre la cifra y el símbolo', () => {
    expect(pct(0.35)).toBe('35 %')
  })

  it('el espacio es irrompible, no un espacio normal', () => {
    expect(pct(0.35)).not.toContain(' %')
    expect(pct(0.35).charCodeAt(2)).toBe(0x00a0)
  })

  it('redondea a entero (sin decimales sueltos)', () => {
    expect(pct(0.3549)).toBe('35 %')
    expect(pct(1)).toBe('100 %')
    expect(pct(0)).toBe('0 %')
  })
})

// 12 meses con ahorro general solo en los indicados (mes → importe).
const meses = (valores: Record<number, number>) =>
  Array.from({ length: 12 }, (_, i) => ({ month: i + 1, savingGeneral: valores[i + 1] ?? null }))

describe('proyeccionDe', () => {
  it('media de los rellenos y proyección con los meses que faltan (el actual incluido)', () => {
    // Enero-marzo rellenos (media 600); hoy es agosto sin rellenar → quedan ago-dic = 5.
    const p = proyeccionDe(meses({ 1: 500, 2: 600, 3: 700 }), 400, null, 8)
    expect(p.mediaMensual).toBe(600)
    expect(p.mesesFuturos).toBe(5)
    expect(p.proyeccion).toBe(1_800 + 400 + 600 * 5) // actual (con extras) + media × futuros
    expect(p.necesarioMensual).toBeNull() // sin objetivo
  })

  it('los meses pasados sin rellenar se dan por perdidos (no cuentan como futuros)', () => {
    // Solo enero relleno, hoy diciembre: futuro = solo diciembre.
    const p = proyeccionDe(meses({ 1: 500 }), 0, null, 12)
    expect(p.mesesFuturos).toBe(1)
    expect(p.proyeccion).toBe(500 + 500 * 1)
  })

  it('el mes actual ya relleno no cuenta como futuro', () => {
    const p = proyeccionDe(meses({ 8: 500 }), 0, null, 8)
    expect(p.mesesFuturos).toBe(4) // sep-dic
  })

  it('necesario mensual = lo que falta del objetivo entre los meses futuros; 0 si cumplido', () => {
    const p = proyeccionDe(meses({ 1: 1_000, 2: 1_000 }), 0, 7_000, 8)
    expect(p.necesarioMensual).toBe(1_000) // faltan 5.000 entre 5 meses
    const cumplido = proyeccionDe(meses({ 1: 8_000 }), 0, 7_000, 8)
    expect(cumplido.necesarioMensual).toBe(0)
  })

  it('sin ningún mes relleno no hay media ni proyección, pero sí necesario', () => {
    const p = proyeccionDe(meses({}), 0, 6_000, 1)
    expect(p.mediaMensual).toBeNull()
    expect(p.proyeccion).toBeNull()
    expect(p.necesarioMensual).toBe(500) // 6.000 entre 12
  })
})

describe('esperadoHoy', () => {
  it('prorratea el objetivo por día del año natural', () => {
    // 2026-07-02 = día 183 de 365.
    expect(esperadoHoy(3_650, 2026, '2026-07-02')).toBeCloseTo(3_650 * (183 / 365), 6)
    expect(esperadoHoy(1_000, 2026, '2026-12-31')).toBeCloseTo(1_000, 6)
  })

  it('años pasados: el objetivo completo; futuros: cero', () => {
    expect(esperadoHoy(5_000, 2024, '2026-08-26')).toBe(5_000)
    expect(esperadoHoy(5_000, 2027, '2026-08-26')).toBe(0)
  })
})
