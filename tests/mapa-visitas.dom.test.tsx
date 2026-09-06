// @vitest-environment jsdom
// Mapa de visitas: lo que importa es que las marcas caigan donde deben, que el
// encuadre se ajuste a los datos (con España sola, el mundo entero es 95 % de
// océano) y que lo que no tiene coordenadas se DIGA en vez de desaparecer.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MapaVisitas } from '@/components/dashboard/panel/mapa-visitas'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)

const caja = () => screen.getByRole('img').getAttribute('viewBox')!.split(' ').map(Number)
// Solo los círculos DEL MAPA: el icono de pin de la leyenda (lucide) trae su
// propio <circle> dentro, y contarlo daba 5 marcas donde hay 3.
const marcas = () => screen.getByRole('img').querySelectorAll('circle')

describe('MapaVisitas', () => {
  const paises = [{ etiqueta: 'España', valor: 4 }]
  const ciudades = [
    { etiqueta: 'Sevilla', valor: 2 },
    { etiqueta: 'Algeciras', valor: 3 },
  ]

  it('pinta una marca por país y por ciudad situada', () => {
    render(<MapaVisitas paises={paises} ciudades={ciudades} />)
    expect(marcas()).toHaveLength(3)
    // El nombre accesible se lee en voz alta: "1 países" ahí canta.
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Mapa con 1 país y 2 ciudades marcadas',
    )
  })

  it('concuerda el singular y el plural del nombre accesible', () => {
    render(<MapaVisitas paises={paises} ciudades={[ciudades[0]]} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Mapa con 1 país y 1 ciudad marcadas',
    )
  })

  it('encuadra sobre los datos y no sobre el mundo entero', () => {
    render(<MapaVisitas paises={paises} ciudades={ciudades} />)
    const [x, y, w, h] = caja()
    expect(w).toBeLessThan(1000)
    expect(w / h).toBeCloseTo(2, 5) // conserva la proporción del lienzo
    expect(x).toBeGreaterThanOrEqual(0)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(x + w).toBeLessThanOrEqual(1000)
    expect(y + h).toBeLessThanOrEqual(500)
  })

  it('«Ver todo el mundo» devuelve el lienzo completo, y vuelve', () => {
    render(<MapaVisitas paises={paises} ciudades={ciudades} />)
    fireEvent.click(screen.getByText('Ver todo el mundo'))
    expect(caja()).toEqual([0, 0, 1000, 500])
    fireEvent.click(screen.getByText('Ajustar a las visitas'))
    expect(caja()[2]).toBeLessThan(1000)
  })

  it('el zoom NO agranda las marcas: se compensan por la escala', () => {
    render(<MapaVisitas paises={paises} ciudades={ciudades} />)
    const rAjustado = Number(marcas()[0].getAttribute('r'))
    const k = caja()[2] / 1000
    fireEvent.click(screen.getByText('Ver todo el mundo'))
    const rMundo = Number(marcas()[0].getAttribute('r'))
    expect(rAjustado).toBeCloseTo(rMundo * k, 5)
  })

  it('lo que no está en la tabla se dice, con su nombre y su cifra', () => {
    render(
      <MapaVisitas paises={paises} ciudades={[{ etiqueta: 'Villa Inventada', valor: 7 }]} />,
    )
    const aviso = screen.getByText(/Sin situar en el mapa/)
    expect(aviso.textContent).toContain('Villa Inventada (7)')
    expect(aviso.textContent).toContain('Siguen contando en los rankings')
  })

  it('las capas filtran, y sin nada que situar lo dice', () => {
    render(<MapaVisitas paises={paises} ciudades={ciudades} />)
    fireEvent.click(screen.getByText('Países (1)'))
    expect(marcas()).toHaveLength(1)
    cleanup()
    render(<MapaVisitas paises={[]} ciudades={[{ etiqueta: 'Villa Inventada', valor: 1 }]} />)
    expect(screen.getByText(/No hay ninguna ubicación que situar/)).toBeTruthy()
  })
})
