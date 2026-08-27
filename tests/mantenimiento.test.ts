// Fechas del sistema de mantenimiento: el encadenado de vencimientos al
// completar (con recorte a fin de mes), la clasificación vencida/próxima/al
// día y los textos en lenguaje natural de la lista (periodicidad y relativos).
import { describe, expect, it, vi } from 'vitest'

// mantenimiento.ts arrastra Prisma y el correo; aquí solo se prueban las puras.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/correo', () => ({ correoConfigurado: () => false, enviarCorreo: vi.fn() }))
vi.mock('@/lib/site', () => ({ SITE_URL: 'https://adrianosuna.com' }))

const { sumarMeses, estadoDe } = await import('@/lib/mantenimiento')

describe('sumarMeses', () => {
  it('suma meses simples y cruza de año', () => {
    expect(sumarMeses('2026-08-25', 1)).toBe('2026-09-25')
    expect(sumarMeses('2026-08-25', 6)).toBe('2027-02-25')
    expect(sumarMeses('2026-12-15', 1)).toBe('2027-01-15')
    expect(sumarMeses('2026-08-25', 12)).toBe('2027-08-25')
  })

  it('recorta a fin de mes: 31 de enero + 1 mes = último día de febrero', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(sumarMeses('2028-01-31', 1)).toBe('2028-02-29') // bisiesto
    expect(sumarMeses('2026-05-31', 1)).toBe('2026-06-30')
  })

  it('el recorte no se hereda: 31 de enero + 2 meses = 31 de marzo', () => {
    expect(sumarMeses('2026-01-31', 2)).toBe('2026-03-31')
  })
})

describe('estadoDe', () => {
  const hoy = '2026-08-25'
  it('vencida si el vencimiento es hoy o anterior', () => {
    expect(estadoDe('2026-08-25', hoy)).toBe('vencida')
    expect(estadoDe('2026-08-01', hoy)).toBe('vencida')
  })

  it('próxima dentro de los 7 días siguientes; al día más allá', () => {
    expect(estadoDe('2026-08-26', hoy)).toBe('proxima')
    expect(estadoDe('2026-09-01', hoy)).toBe('proxima') // justo 7 días
    expect(estadoDe('2026-09-02', hoy)).toBe('aldia')
  })
})

// ─────────── Textos de la lista (lenguaje natural, sin fechas que restar) ───

const { periodicidad, cuando, antiguedad } = await import('@/components/dashboard/panel/mantenimiento')

describe('periodicidad', () => {
  it('los intervalos habituales se dicen en una palabra', () => {
    expect(periodicidad(1)).toBe('Mensual')
    expect(periodicidad(3)).toBe('Trimestral')
    expect(periodicidad(6)).toBe('Semestral')
    expect(periodicidad(12)).toBe('Anual')
  })

  it('los raros caen a "cada N meses" (o años si son exactos)', () => {
    expect(periodicidad(5)).toBe('Cada 5 meses')
    expect(periodicidad(36)).toBe('Cada 3 años')
  })
})

describe('cuando', () => {
  const hoy = '2026-08-26'

  it('hoy, mañana y ayer se dicen con palabras', () => {
    expect(cuando('2026-08-26', hoy)).toBe('Vence hoy')
    expect(cuando('2026-08-27', hoy)).toBe('Mañana')
    expect(cuando('2026-08-25', hoy)).toBe('Venció ayer')
  })

  it('el retraso se cuenta en días y, a partir del mes, en meses', () => {
    expect(cuando('2026-08-20', hoy)).toBe('Hace 6 días')
    expect(cuando('2026-07-27', hoy)).toBe('Hace un mes')
    expect(cuando('2026-05-26', hoy)).toBe('Hace 3 meses')
  })

  it('lo que falta: días hasta dos meses, después en meses o años', () => {
    expect(cuando('2026-09-25', hoy)).toBe('En 30 días')
    expect(cuando('2026-12-26', hoy)).toBe('En 4 meses')
    expect(cuando('2027-08-26', hoy)).toBe('En 1 año')
  })
})

describe('antiguedad', () => {
  const hoy = '2026-08-26'
  it('describe cuándo se hizo por última vez', () => {
    expect(antiguedad('2026-08-26', hoy)).toBe('hecha hoy')
    expect(antiguedad('2026-08-25', hoy)).toBe('hecha ayer')
    expect(antiguedad('2026-08-20', hoy)).toBe('hecha hace 6 días')
    expect(antiguedad('2026-07-27', hoy)).toBe('hecha hace un mes')
    expect(antiguedad('2025-08-26', hoy)).toBe('hecha hace un año')
  })
})

