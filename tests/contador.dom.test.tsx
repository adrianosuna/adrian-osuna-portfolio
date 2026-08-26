// @vitest-environment jsdom
// Contador animado de la franja de cifras: el servidor pinta el valor final
// (SEO/sin-JS), la animación arranca al entrar en pantalla y termina en el
// valor exacto, y con prefers-reduced-motion no se anima.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Contador } from '@/components/landing/contador'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// matchMedia no existe en jsdom: se simula (con o sin reduced-motion).
const conMatchMedia = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduce })))

// IntersectionObserver simulado: captura el callback para dispararlo a mano.
class ObserverFalso {
  static callback: (entradas: Array<{ isIntersecting: boolean }>) => void
  constructor(cb: (entradas: Array<{ isIntersecting: boolean }>) => void) {
    ObserverFalso.callback = cb
  }
  observe() {}
  disconnect() {}
}

describe('Contador', () => {
  it('renderiza el valor final de entrada (lo que ven SEO y sin-JS)', () => {
    conMatchMedia(false)
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Contador numero={5} sufijo="+" />)
    expect(screen.getByText('5+')).toBeTruthy()
  })

  it('con prefers-reduced-motion no anima: se queda en el valor final', () => {
    conMatchMedia(true)
    vi.stubGlobal('IntersectionObserver', ObserverFalso)
    render(<Contador numero={5} sufijo="+" />)
    expect(screen.getByText('5+')).toBeTruthy()
    expect(ObserverFalso.callback).toBeUndefined() // ni siquiera observa
  })

  it('al entrar en pantalla cuenta desde 0 y termina clavado en el valor', async () => {
    conMatchMedia(false)
    ObserverFalso.callback = undefined as never
    vi.stubGlobal('IntersectionObserver', ObserverFalso)
    // rAF y reloj controlados a mano: el rAF real de jsdom se muere de hambre
    // cuando la suite corre en paralelo y hacía este test intermitente.
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('performance', { now: () => 1000 })
    const { act } = await import('react')
    render(<Contador numero={5} sufijo="+" />)
    expect(ObserverFalso.callback).toBeDefined()
    act(() => ObserverFalso.callback([{ isIntersecting: true }]))
    // Arranca en 0...
    expect(screen.getByText('0+')).toBeTruthy()
    // ...a mitad de animación va por un valor intermedio (easing, ni 0 ni 5)...
    act(() => frames.shift()!(1450))
    const mitad = Number(screen.getByText(/^\d\+$/).textContent!.replace('+', ''))
    expect(mitad).toBeGreaterThan(0)
    expect(mitad).toBeLessThan(5)
    // ...y pasado el plazo aterriza exactamente en 5+ y deja de pedir frames.
    act(() => frames.shift()!(2000))
    expect(screen.getByText('5+')).toBeTruthy()
    expect(frames).toHaveLength(0)
  })

  it('si aún no está en pantalla, no arranca', async () => {
    conMatchMedia(false)
    vi.stubGlobal('IntersectionObserver', ObserverFalso)
    const { act } = await import('react')
    render(<Contador numero={5} sufijo="+" />)
    act(() => ObserverFalso.callback([{ isIntersecting: false }]))
    expect(screen.getByText('5+')).toBeTruthy() // sigue el valor SSR, sin reset a 0
  })
})
