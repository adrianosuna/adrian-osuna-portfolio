// @vitest-environment jsdom
// Tooltip propio: retardo con ratón, inmediato con foco, cierre con Escape,
// aria-describedby, sin cambiar el DOM del hijo; `envuelto` para disabled.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Tooltip } from '@/components/ui/tooltip'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Tooltip', () => {
  it('no añade nada al DOM del hijo y abre con retardo al pasar el ratón', () => {
    vi.useFakeTimers()
    const { container } = render(
      <Tooltip texto="Editar la fila">
        <button type="button" aria-label="Editar">✎</button>
      </Tooltip>,
    )
    // Un solo nodo, el botón: nada de spans envolviendo.
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild?.tagName).toBe('BUTTON')

    const boton = screen.getByLabelText('Editar')
    fireEvent.mouseEnter(boton)
    expect(screen.queryByRole('tooltip')).toBeNull() // todavía no: retardo
    act(() => vi.advanceTimersByTime(400))
    const globo = screen.getByRole('tooltip')
    expect(globo.textContent).toBe('Editar la fila')
    // Mientras está visible, el hijo lo referencia.
    expect(boton.getAttribute('aria-describedby')).toBe(globo.id)

    fireEvent.mouseLeave(boton)
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(boton.getAttribute('aria-describedby')).toBeNull()
  })

  it('con el foco abre al instante y Escape lo cierra', () => {
    vi.useFakeTimers()
    render(
      <Tooltip texto="Vence el 12/09">
        <button type="button">Fecha</button>
      </Tooltip>,
    )
    fireEvent.focus(screen.getByText('Fecha'))
    expect(screen.getByRole('tooltip').textContent).toBe('Vence el 12/09')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('sin texto devuelve el hijo tal cual, sin manejadores', () => {
    vi.useFakeTimers()
    render(
      <Tooltip texto={undefined}>
        <span>Casa</span>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByText('Casa'))
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('encadena los manejadores que el hijo ya tenía', () => {
    vi.useFakeTimers()
    const propio = vi.fn()
    render(
      <Tooltip texto="Ayuda">
        <button type="button" onMouseEnter={propio}>Ir</button>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByText('Ir'))
    expect(propio).toHaveBeenCalledTimes(1)
  })

  it('envuelto: un botón deshabilitado también explica su motivo', () => {
    vi.useFakeTimers()
    const { container } = render(
      <Tooltip texto="La usan 3 movimientos" envuelto>
        <button type="button" disabled aria-label="Eliminar">🗑</button>
      </Tooltip>,
    )
    const envoltorio = container.firstElementChild as HTMLElement
    expect(envoltorio.tagName).toBe('SPAN')
    // El hijo deja pasar el ratón al envoltorio.
    expect(screen.getByLabelText('Eliminar').className).toContain('pointer-events-none')
    fireEvent.mouseEnter(envoltorio)
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByRole('tooltip').textContent).toBe('La usan 3 movimientos')
  })
})

// Dos fallos vistos al revisarlo en el navegador con sesión.
describe('un solo globo, y el clic lo cierra', () => {
  it('el ratón en uno y el foco en otro NO dejan dos globos', () => {
    vi.useFakeTimers()
    render(
      <>
        <Tooltip texto="Uno"><button type="button">A</button></Tooltip>
        <Tooltip texto="Dos"><button type="button">B</button></Tooltip>
      </>,
    )
    fireEvent.mouseEnter(screen.getByText('A'))
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getAllByRole('tooltip')).toHaveLength(1)
    // Tab al segundo SIN mover el ratón: el primero no recibe mouseleave.
    fireEvent.focus(screen.getByText('B'))
    const globos = screen.getAllByRole('tooltip')
    expect(globos).toHaveLength(1)
    expect(globos[0].textContent).toBe('Dos')
  })

  it('al pulsar se cierra (si no, se queda colgado por el foco tras el clic)', () => {
    vi.useFakeTimers()
    render(
      <Tooltip texto="Editar">
        <button type="button">Editar</button>
      </Tooltip>,
    )
    const boton = screen.getByText('Editar')
    fireEvent.mouseEnter(boton)
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.pointerDown(boton)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('pero en un hijo APAGADO el clic no lo cierra: es la explicación de por qué', () => {
    vi.useFakeTimers()
    const { container } = render(
      <Tooltip texto="La usan 3 movimientos" envuelto>
        <button type="button" disabled>🗑</button>
      </Tooltip>,
    )
    const envoltorio = container.firstElementChild as HTMLElement
    fireEvent.mouseEnter(envoltorio)
    act(() => vi.advanceTimersByTime(400))
    fireEvent.pointerDown(envoltorio)
    expect(screen.getByRole('tooltip').textContent).toBe('La usan 3 movimientos')
  })
})
