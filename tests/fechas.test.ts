// Nombres de meses y días: una sola fuente (antes había diez copias con cinco
// nombres distintos y dos capitalizaciones). Las abreviaturas se DERIVAN de la
// lista larga, así que no pueden desincronizarse.
import { describe, expect, it } from 'vitest'
import { DIAS, MESES, mesCorto, mesInicial, nombreMes } from '@/lib/fechas'

describe('MESES y DIAS', () => {
  it('doce meses sin abreviar y con inicial mayúscula', () => {
    expect(MESES).toHaveLength(12)
    expect(MESES[0]).toBe('Enero')
    expect(MESES[11]).toBe('Diciembre')
    expect(MESES.every((m) => m[0] === m[0].toUpperCase())).toBe(true)
  })

  it('siete días sin abreviar, empezando en domingo (getUTCDay)', () => {
    expect(DIAS).toHaveLength(7)
    expect(DIAS[0]).toBe('Domingo')
    expect(DIAS[1]).toBe('Lunes')
    expect(DIAS[6]).toBe('Sábado')
  })
})

describe('derivados', () => {
  it('nombreMes va por número 1-12', () => {
    expect(nombreMes(1)).toBe('Enero')
    expect(nombreMes(8)).toBe('Agosto')
    expect(nombreMes(12)).toBe('Diciembre')
  })

  it('mesCorto da las tres primeras letras, únicas entre sí', () => {
    const cortos = MESES.map((_, i) => mesCorto(i))
    expect(cortos).toEqual([
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
    ])
    // Si dos meses compartieran abreviatura, el eje sería ambiguo.
    expect(new Set(cortos).size).toBe(12)
  })

  it('mesInicial da una letra (el eje más estrecho)', () => {
    expect(MESES.map((_, i) => mesInicial(i)).join('')).toBe('EFMAMJJASOND')
  })

  it('fuera de rango no revienta: cadena vacía', () => {
    expect(nombreMes(0)).toBe('')
    expect(nombreMes(13)).toBe('')
    expect(mesCorto(12)).toBe('')
    expect(mesInicial(-1)).toBe('')
  })
})
