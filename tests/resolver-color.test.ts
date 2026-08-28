// @vitest-environment jsdom
// resolverColor: canvas NO entiende `var(--primary)`. Los consumidores pasan
// colores así (en SVG funcionaba tal cual) y Chart.js los pintaría en NEGRO,
// que es exactamente el fallo que se colcó al migrar el donut del ahorro.
import { beforeEach, describe, expect, it } from 'vitest'
import { resolverColor, token } from '@/components/ui/charts/comun'

beforeEach(() => {
  document.documentElement.style.setProperty('--primary', '#10b981')
  document.documentElement.style.setProperty('--viajes', '#a78bfa')
})

describe('resolverColor', () => {
  it('resuelve un var() del tema al color real', () => {
    expect(resolverColor('var(--primary)')).toBe('#10b981')
    expect(resolverColor('var(--viajes)')).toBe('#a78bfa')
  })

  it('tolera espacios dentro del var()', () => {
    expect(resolverColor('  var( --primary )  ')).toBe('#10b981')
  })

  it('usa el respaldo del propio var() si el token no existe', () => {
    expect(resolverColor('var(--no-existe, #ff0000)')).toBe('#ff0000')
  })

  it('deja pasar los colores que ya son colores', () => {
    expect(resolverColor('#94a3b8')).toBe('#94a3b8')
    expect(resolverColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)')
    // Una función CSS que no sea var() se devuelve tal cual.
    expect(resolverColor('color-mix(in oklab, red, blue)')).toBe('color-mix(in oklab, red, blue)')
  })

  it('nunca devuelve un var() sin resolver (sería negro en canvas)', () => {
    for (const c of ['var(--primary)', 'var(--no-existe)', 'var( --viajes , #000 )']) {
      expect(resolverColor(c).startsWith('var(')).toBe(false)
    }
  })

  it('token cae al respaldo cuando la variable no está definida', () => {
    expect(token('--tampoco-existe', '#123456')).toBe('#123456')
  })
})
