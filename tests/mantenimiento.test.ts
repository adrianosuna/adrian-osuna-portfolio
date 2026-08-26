// Fechas del sistema de mantenimiento: el encadenado de vencimientos al
// completar (con recorte a fin de mes) y la clasificación vencida/próxima/al día.
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
