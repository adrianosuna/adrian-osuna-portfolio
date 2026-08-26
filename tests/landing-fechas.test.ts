// Fechas y duraciones de la experiencia (estilo LinkedIn): rangos "Mes Año —
// Actualidad" y duraciones con conteo INCLUSIVO ("Julio 2021 → Agosto 2026"
// son 5 años y 2 meses, no 5 y 1). Se congela el reloj: son cálculos "al día".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { companyDuration, periodLabel, yearsSince } from '@/lib/landing/content'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-25T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('periodLabel', () => {
  it('rango cerrado con nombres de mes en español', () => {
    expect(periodLabel({ y: 2021, m: 3 }, { y: 2021, m: 6 })).toBe('Marzo 2021 — Junio 2021')
  })

  it('sin fin = Actualidad', () => {
    expect(periodLabel({ y: 2024, m: 1 })).toBe('Enero 2024 — Actualidad')
  })
})

describe('yearsSince', () => {
  it('años completos desde una fecha (para la franja de cifras "5+")', () => {
    expect(yearsSince({ y: 2021, m: 7 })).toBe(5)
  })

  it('no redondea al alza: 11 meses son 0 años', () => {
    expect(yearsSince({ y: 2025, m: 9 })).toBe(0)
  })
})

describe('companyDuration', () => {
  it('conteo inclusivo como LinkedIn (jul 2021 → ago 2026 = 5 años y 2 meses)', () => {
    expect(companyDuration([{ start: { y: 2021, m: 7 } }])).toBe('5 años y 2 meses')
  })

  it('rango cerrado: prácticas de marzo a junio = 4 meses', () => {
    expect(companyDuration([{ start: { y: 2021, m: 3 }, end: { y: 2021, m: 6 } }])).toBe('4 meses')
  })

  it('con varios roles cuenta del primer inicio a la actualidad si alguno sigue vivo', () => {
    expect(
      companyDuration([{ start: { y: 2024, m: 1 } }, { start: { y: 2021, m: 7 } }]),
    ).toBe('5 años y 2 meses')
  })

  it('singular correcto: un solo mes', () => {
    expect(companyDuration([{ start: { y: 2026, m: 8 }, end: { y: 2026, m: 8 } }])).toBe('1 mes')
  })
})
