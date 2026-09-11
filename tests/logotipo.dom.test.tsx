// @vitest-environment jsdom
// El logo: las dos trampas mudas (`evenodd`, sin él la A sale maciza; y
// `aria-hidden`, o el enlace se anunciaría solo) y que el trazo siga con tres contornos.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Logotipo } from '@/components/ui/logotipo'
import { MARCA_ALTO, MARCA_ANCHO, MARCA_D } from '@/lib/marca'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(cleanup)

const pintar = () => {
  const { container } = render(<Logotipo className="h-6 w-auto" />)
  const svg = container.querySelector('svg')!
  return { svg, path: svg.querySelector('path')! }
}

describe('Logotipo', () => {
  it('pinta el trazo con fill-rule evenodd: sin él la A sale maciza', () => {
    const { path } = pintar()
    expect(path.getAttribute('d')).toBe(MARCA_D)
    // El atributo puede venir del <svg> o del <path>; lo que importa es que
    // el trazo lo tenga en vigor.
    const { svg } = pintar()
    const regla = path.getAttribute('fill-rule') ?? svg.getAttribute('fill-rule')
    expect(regla).toBe('evenodd')
  })

  it('es decorativo: el nombre lo pone el enlace que lo envuelve', () => {
    const { svg } = pintar()
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.textContent).toBe('')
  })

  it('hereda el color del texto, para valer en la landing y en el panel', () => {
    const { svg } = pintar()
    expect(svg.getAttribute('fill')).toBe('currentColor')
    expect(svg.getAttribute('class')).toContain('h-6')
  })

  it('la caja del viewBox es la del trazo', () => {
    const { svg } = pintar()
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${MARCA_ANCHO} ${MARCA_ALTO}`)
  })
})

describe('el trazo', () => {
  it('son TRES contornos cerrados: el anillo, la A y el hueco de la A', () => {
    expect(MARCA_D.match(/M/g)).toHaveLength(3)
    expect(MARCA_D.match(/Z/g)).toHaveLength(3)
    expect(MARCA_D.endsWith('Z')).toBe(true)
  })

  it('no se sale de su caja', () => {
    const nums = MARCA_D.match(/-?\d+(\.\d+)?/g)!.map(Number)
    const xs = nums.filter((_, i) => i % 2 === 0)
    const ys = nums.filter((_, i) => i % 2 === 1)
    expect(Math.min(...xs, ...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xs)).toBeLessThanOrEqual(MARCA_ANCHO)
    expect(Math.max(...ys)).toBeLessThanOrEqual(MARCA_ALTO)
  })
})
