// Parser del mes escrito a mano en la paleta ⌘K: "marzo", "mar", "2026-03".
// Es lo que convierte la caja de búsqueda en un "ir al mes", y el sitio donde
// una entrada rara (un mes 13, una palabra que no es un mes) tiene que decir
// que no en vez de navegar a un mes inventado.
import { describe, expect, it, vi } from 'vitest'

// El componente arrastra sus server actions (Prisma, correo): aquí solo
// interesa la función pura.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/auth', () => ({ requireAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { mesEscrito } = await import('@/components/dashboard/acciones-rapidas')

const HOY = '2026-09-02'

describe('mesEscrito', () => {
  it('entiende el formato ISO', () => {
    expect(mesEscrito('2026-03', HOY)).toBe('2026-03')
    expect(mesEscrito('2025-12', HOY)).toBe('2025-12')
    // Un dígito: se normaliza a dos.
    expect(mesEscrito('2026-3', HOY)).toBe('2026-03')
  })

  it('rechaza meses fuera de rango', () => {
    expect(mesEscrito('2026-13', HOY)).toBeNull()
    expect(mesEscrito('2026-00', HOY)).toBeNull()
  })

  it('entiende el nombre del mes, con y sin año', () => {
    expect(mesEscrito('marzo', HOY)).toBe('2026-03')
    expect(mesEscrito('marzo 2025', HOY)).toBe('2025-03')
    expect(mesEscrito('Diciembre', HOY)).toBe('2026-12')
  })

  it('acepta las tres primeras letras y no distingue tildes', () => {
    expect(mesEscrito('mar', HOY)).toBe('2026-03')
    expect(mesEscrito('ene', HOY)).toBe('2026-01')
    // "Málaga" no, pero el mes con tilde sí (ninguno la tiene, y aun así).
    expect(mesEscrito('sep', HOY)).toBe('2026-09')
  })

  it('con menos de tres letras no adivina', () => {
    // "ma" sería marzo o mayo: mejor no elegir por el usuario.
    expect(mesEscrito('ma', HOY)).toBeNull()
    expect(mesEscrito('a', HOY)).toBeNull()
  })

  it('lo que no es un mes devuelve null (y no estorba a la búsqueda)', () => {
    expect(mesEscrito('mercadona', HOY)).toBeNull()
    expect(mesEscrito('', HOY)).toBeNull()
    expect(mesEscrito('   ', HOY)).toBeNull()
    expect(mesEscrito('2026', HOY)).toBeNull()
    expect(mesEscrito('caldera', HOY)).toBeNull()
  })

  it('el año por defecto es el del "hoy" que se le pasa', () => {
    expect(mesEscrito('enero', '2030-05-10')).toBe('2030-01')
  })
})
