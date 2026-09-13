// @vitest-environment jsdom
// Barra de scroll flotante: cuándo se monta, la geometría del pulgar, el clic en
// la pista y el seguimiento del scroll.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { BarraScroll } from '@/components/ui/barra-scroll'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// Página de 3000 px en una ventana de 800: el pulgar mide 800/3000·800 ≈ 213 px.
const preparar = ({ punteroFino = true, alto = 3000 } = {}) => {
  vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches: q === '(pointer: fine)' && punteroFino })))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: alto, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true })
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
  window.scrollTo = vi.fn()
}
const pista = () => document.querySelector<HTMLElement>('div[aria-hidden="true"].fixed')
const pulgar = () => pista()?.firstElementChild as HTMLElement | null

beforeEach(() => preparar())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BarraScroll', () => {
  it('se monta con puntero fino y página que desborda, con el pulgar a escala', () => {
    render(<BarraScroll />)
    expect(pista()).toBeTruthy()
    expect(parseFloat(pulgar()!.style.height)).toBeCloseTo(213.3, 0)
  })

  it('no se monta si la página no desborda ni con puntero grueso (táctil)', () => {
    preparar({ alto: 800 })
    const { unmount } = render(<BarraScroll />)
    expect(pista()).toBeNull()
    unmount()
    preparar({ punteroFino: false })
    render(<BarraScroll />)
    expect(pista()).toBeNull()
  })

  it('sigue al scroll: a mitad de página, el pulgar va a mitad de pista', () => {
    render(<BarraScroll />)
    window.scrollY = 1100 // mitad de los 2200 px desplazables
    fireEvent.scroll(window)
    expect(pulgar()!.style.transform).toContain('293.3') // (800 − 213,3) / 2
  })

  it('un clic en la pista lleva la página a ese punto', () => {
    render(<BarraScroll />)
    fireEvent.click(pista()!, { clientY: 400 })
    const llamada = (window.scrollTo as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as { top: number }
    expect(llamada.top).toBeCloseTo(1100, 0)
  })

  it('el pulgar es decorativo: la pista va aria-hidden y nada dentro entra en el tabulador', () => {
    render(<BarraScroll />)
    expect(pista()!.querySelectorAll('[tabindex]:not([tabindex="-1"]), button, a')).toHaveLength(0)
  })
})
