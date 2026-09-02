// @vitest-environment jsdom
// Menú de acciones de una fila: iconos en escritorio, «⋯» con menú en móvil.
//
// Lo que se comprueba es el CONTRATO, no el aspecto (jsdom no aplica media
// queries: las dos variantes están siempre en el DOM y las oculta Tailwind):
//   · con pocas acciones NO hay menú — esconder dos iconos detrás de un menú
//     son dos toques donde había uno;
//   · con muchas, el disparador existe y se anuncia como menú;
//   · cada acción tiene NOMBRE (no solo icono) y se ejecuta una sola vez;
//   · una acción apagada no se dispara y explica por qué;
//   · y el menú se cierra al elegir.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { MenuAcciones, type AccionFila } from '@/components/dashboard/menu-acciones'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(cleanup)

const icono = <span data-testid="icono" />

const tres = (extra: Partial<AccionFila> = {}): AccionFila[] => [
  { id: 'editar', label: 'Editar', icon: icono, onClick: vi.fn() },
  { id: 'dividir', label: 'Dividir en varias categorías', icon: icono, onClick: vi.fn() },
  { id: 'eliminar', label: 'Eliminar', icon: icono, destructiva: true, onClick: vi.fn(), ...extra },
]

/** Abre el menú y devuelve su elemento. */
const abrir = (etiqueta = 'Mercadona') => {
  fireEvent.click(screen.getByRole('button', { name: `Acciones de ${etiqueta}` }))
  return screen.getByRole('menu', { name: `Acciones de ${etiqueta}` })
}

describe('cuándo hay menú', () => {
  it('con dos acciones (y umbral de tres) no aparece el disparador', () => {
    render(
      <MenuAcciones
        etiqueta="Mercadona"
        acciones={[
          { id: 'a', label: 'Editar', icon: icono, onClick: vi.fn() },
          { id: 'b', label: 'Eliminar', icon: icono, onClick: vi.fn() },
        ]}
      />,
    )
    expect(screen.queryByRole('button', { name: /Acciones de/ })).toBeNull()
    // Los dos iconos siguen ahí, cada uno con su nombre.
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeTruthy()
  })

  it('con tres, el disparador existe y se anuncia como menú', () => {
    render(<MenuAcciones etiqueta="Mercadona" acciones={tres()} />)
    const boton = screen.getByRole('button', { name: 'Acciones de Mercadona' })
    expect(boton.getAttribute('aria-haspopup')).toBe('menu')
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    // Cerrado, no hay menú en el DOM.
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('un umbral más bajo lo activa con dos acciones', () => {
    render(
      <MenuAcciones
        etiqueta="Revisar la caldera"
        desde={2}
        acciones={[
          { id: 'a', label: 'Editar', icon: icono, onClick: vi.fn() },
          { id: 'b', label: 'Eliminar', icon: icono, onClick: vi.fn() },
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Acciones de Revisar la caldera' })).toBeTruthy()
  })
})

describe('el menú', () => {
  it('lista las acciones por su NOMBRE, no por su icono', () => {
    render(<MenuAcciones etiqueta="Mercadona" acciones={tres()} />)
    const menu = abrir()
    const items = [...menu.querySelectorAll('[role="menuitem"]')].map((n) => n.textContent)
    expect(items).toEqual(['Editar', 'Dividir en varias categorías', 'Eliminar'])
  })

  it('ejecuta la acción elegida UNA vez y se cierra', () => {
    const acciones = tres()
    render(<MenuAcciones etiqueta="Mercadona" acciones={acciones} />)
    abrir()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))

    expect(acciones[0].onClick).toHaveBeenCalledTimes(1)
    expect(acciones[1].onClick).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('una acción apagada explica el motivo y no se dispara', () => {
    // El caso real: una categoría en uso no se puede borrar. En un icono el
    // motivo solo cabía en un `title` (invisible en móvil); en el menú se lee.
    const acciones = tres({
      disabled: true,
      motivo: 'La usan 12 movimientos. Fusiónala en otra.',
    })
    render(<MenuAcciones etiqueta="Supermercado" acciones={acciones} />)
    const menu = abrir('Supermercado')

    const item = screen.getByRole('menuitem', { name: /Eliminar/ })
    expect(item).toHaveProperty('disabled', true)
    expect(menu.textContent).toContain('La usan 12 movimientos')

    fireEvent.click(item)
    expect(acciones[2].onClick).not.toHaveBeenCalled()
  })

  it('se cierra con Escape', () => {
    render(<MenuAcciones etiqueta="Mercadona" acciones={tres()} />)
    abrir()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('se cierra al hacer clic fuera', () => {
    render(<MenuAcciones etiqueta="Mercadona" acciones={tres()} />)
    abrir()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('axe', () => {
  const auditar = async (nodo: Element) => {
    const res = await axe.run(nodo, {
      // Ver `accesibilidad.dom.test.tsx`: sin layout no son evaluables.
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    })
    return res.violations.map((v) => ({ regla: v.id, donde: v.nodes[0]?.target?.join(' ') }))
  }

  it('sin violaciones cerrado', async () => {
    const { baseElement } = render(<MenuAcciones etiqueta="Mercadona" acciones={tres()} />)
    expect(await auditar(baseElement)).toEqual([])
  })

  it('sin violaciones con el menú abierto', async () => {
    const { baseElement } = render(<MenuAcciones etiqueta="Mercadona" acciones={tres()} />)
    abrir()
    expect(await auditar(baseElement)).toEqual([])
  })
})
