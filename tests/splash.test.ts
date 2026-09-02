// Pantallas de arranque de iOS. Se prueban porque es una tabla de datos que
// falla EN SILENCIO: si una media query no cuadra con ningún dispositivo, iOS
// simplemente no pinta la imagen y vuelve el fogonazo blanco — no hay error que
// lo delate. Y si un tamaño no está en la allowlist de la ruta, su `<link>`
// apunta a un 404.
import { describe, expect, it } from 'vitest'
import { DIMENSIONES_SPLASH, LINKS_SPLASH, SPLASHES } from '@/lib/splash'

describe('tabla de splashes', () => {
  it('cada entrada tiene un tamaño con formato anchoxalto', () => {
    for (const s of SPLASHES) {
      expect(s.dim).toMatch(/^\d{3,4}x\d{3,4}$/)
    }
  })

  it('el tamaño físico es el lógico por la densidad', () => {
    // Es LA regla del asunto: iOS busca la imagen del tamaño exacto en píxeles
    // reales. Un redondeo mal puesto aquí y la imagen se descarta.
    for (const s of SPLASHES) {
      const [w, h] = s.dim.split('x').map(Number)
      expect(w).toBe(s.w * s.ratio)
      expect(h).toBe(s.h * s.ratio)
    }
  })

  it('no hay tamaños repetidos', () => {
    expect(new Set(DIMENSIONES_SPLASH).size).toBe(DIMENSIONES_SPLASH.length)
  })

  it('no hay dos entradas con la MISMA media query', () => {
    // Dos `<link>` con idéntico media serían ambiguos: iOS se queda con uno y
    // el otro es peso muerto.
    const medias = LINKS_SPLASH.map((l) => l.media)
    expect(new Set(medias).size).toBe(medias.length)
  })

  it('cada link apunta a un tamaño de la allowlist de la ruta', () => {
    for (const l of LINKS_SPLASH) {
      const dim = l.url.replace('/splash/', '')
      expect(DIMENSIONES_SPLASH).toContain(dim)
    }
  })

  it('la media query lleva las tres condiciones que mira iOS', () => {
    for (const l of LINKS_SPLASH) {
      expect(l.media).toMatch(/device-width: \d+px/)
      expect(l.media).toMatch(/device-height: \d+px/)
      expect(l.media).toMatch(/-webkit-device-pixel-ratio: \d/)
      expect(l.rel).toBe('apple-touch-startup-image')
    }
  })

  it('cubre el iPhone de referencia (375x812 @3x) y un iPad', () => {
    // 375x812 es el viewport con el que se revisó la accesibilidad móvil.
    expect(SPLASHES.some((s) => s.w === 375 && s.h === 812 && s.ratio === 3)).toBe(true)
    expect(SPLASHES.some((s) => s.w >= 768)).toBe(true)
  })
})
