// Color automático de las categorías: la aplicación elige el tono más alejado
// de los que ya se usan, así que nunca sale un color repetido.
import { describe, expect, it } from 'vitest'
import { colorDeTono, colorLibre, tonoDe } from '@/lib/colores'

describe('tonoDe', () => {
  it('lee el tono de un hexadecimal', () => {
    expect(tonoDe('#ff0000')).toBe(0)
    expect(tonoDe('#00ff00')).toBe(120)
    expect(tonoDe('#0000ff')).toBe(240)
    expect(tonoDe('#10b981')).toBe(160) // el esmeralda del tema
  })

  it('devuelve null si no es un color válido', () => {
    expect(tonoDe('rojo')).toBeNull()
    expect(tonoDe('#abc')).toBeNull()
    expect(tonoDe('')).toBeNull()
  })
})

describe('colorDeTono', () => {
  it('da un hexadecimal de seis dígitos', () => {
    for (const tono of [0, 45, 160, 359]) {
      expect(colorDeTono(tono)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('el color generado conserva su tono (ida y vuelta)', () => {
    for (const tono of [0, 30, 90, 200, 300]) {
      // ±2º de margen: el redondeo a enteros de 0-255 mueve un poco el tono.
      expect(Math.abs((tonoDe(colorDeTono(tono)) as number) - tono)).toBeLessThanOrEqual(2)
    }
  })
})

describe('colorLibre', () => {
  it('sin colores previos empieza por el esmeralda de la casa', () => {
    expect(tonoDe(colorLibre([]))).toBeCloseTo(160, -1)
  })

  it('elige el tono más lejano del que ya se usa', () => {
    // Con un solo color, el más lejano es su opuesto (±180º).
    const tono = tonoDe(colorLibre(['#ff0000'])) as number
    expect(Math.min(Math.abs(tono - 180), Math.abs(tono - 180) % 360)).toBeLessThanOrEqual(2)
  })

  it('nunca repite un color ya usado, ni con muchos', () => {
    const usados: string[] = []
    for (let i = 0; i < 30; i += 1) {
      const nuevo = colorLibre(usados)
      expect(usados).not.toContain(nuevo)
      usados.push(nuevo)
    }
    expect(new Set(usados).size).toBe(30)
  })

  it('ignora los valores que no son colores', () => {
    expect(colorLibre(['no soy un color', ''])).toMatch(/^#[0-9a-f]{6}$/)
  })
})
