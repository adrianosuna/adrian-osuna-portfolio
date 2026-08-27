// @vitest-environment jsdom
// La gráfica de barras del año pinta su lienzo con el ANCHO REAL de su
// contenedor (escala 1:1 a cualquier ancho) en vez de estirar un lienzo fijo.
// Se comprueban las dos vías de medida: la síncrona del montaje y el aviso
// posterior del ResizeObserver (redimensionar la ventana).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'

// El módulo importa sus server actions (→ prisma → auth): se mockean para
// poder renderizar solo la gráfica.
vi.mock('@/app/app/finance/gastos-actions', () => ({
  createGasto: vi.fn(),
  updateGasto: vi.fn(),
  deleteGasto: vi.fn(),
  createCategoria: vi.fn(),
  updateCategoria: vi.fn(),
  deleteCategoria: vi.fn(),
}))

const { BarrasAnio } = await import('@/components/dashboard/savings/gastos')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const MESES = Array.from({ length: 12 }, (_, i) => ({
  mes: i + 1,
  ingresos: 1850,
  gastos: 1200 + i * 10,
}))

// jsdom no implementa ResizeObserver ni da medidas: se simulan ambos.
let avisar: (() => void) | null = null
let anchoSimulado = 0

beforeEach(() => {
  avisar = null
  anchoSimulado = 0
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => anchoSimulado,
  })
  class ROFalso {
    constructor(private cb: () => void) {}
    observe() {
      avisar = this.cb
    }
    disconnect() {
      avisar = null
    }
  }
  ;(globalThis as Record<string, unknown>).ResizeObserver = ROFalso
})

afterEach(cleanup)

const viewBox = (c: HTMLElement) => c.querySelector('svg')?.getAttribute('viewBox')

describe('BarrasAnio', () => {
  it('mide su contenedor al montar y pinta el lienzo a ese ancho', () => {
    anchoSimulado = 1053
    const { container } = render(<BarrasAnio meses={MESES} />)
    // Ancho del viewBox = ancho del hueco → escala exactamente 1.
    expect(viewBox(container)).toBe('0 0 1053 253')
  })

  it('repinta con el nuevo ancho cuando avisa el ResizeObserver', () => {
    anchoSimulado = 1053
    const { container } = render(<BarrasAnio meses={MESES} />)
    anchoSimulado = 640
    act(() => avisar?.())
    expect(viewBox(container)).toBe('0 0 640 200')
  })

  it('en un hueco estrecho usa el eje abreviado y las iniciales de los meses', () => {
    anchoSimulado = 309
    const { container } = render(<BarrasAnio meses={MESES} />)
    expect(viewBox(container)).toBe('0 0 309 180')
    const textos = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(textos.slice(0, 2)).toEqual(['1k', '2k'])
    expect(textos.slice(2).join('')).toBe('EFMAMJJASOND')
  })

  it('sin medida todavía no pinta el SVG, pero reserva el alto (sin salto)', () => {
    anchoSimulado = 0
    const { container } = render(<BarrasAnio meses={MESES} />)
    expect(container.querySelector('svg')).toBeNull()
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe('200px')
  })
})
