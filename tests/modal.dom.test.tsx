// @vitest-environment jsdom
// Modal común del dashboard: estructura (cabecera, pie, cierre), Escape,
// clic en el fondo, bloqueo del scroll y la convivencia con los popovers de
// fields.tsx (portalizados: Escape cierra primero el popover, no el modal).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Modal } from '@/components/ui/modal'
import { SelectField } from '@/components/ui/fields'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(cleanup)

const montar = (onClose = vi.fn()) => {
  render(
    <Modal title="Título del modal" description="Subtítulo" onClose={onClose} footer={<button type="button">Guardar</button>}>
      <p>Contenido</p>
    </Modal>,
  )
  return onClose
}

describe('Modal', () => {
  it('pinta título, descripción, contenido, pie y botón de cierre', () => {
    const onClose = montar()
    expect(screen.getByRole('dialog', { name: 'Título del modal' })).toBeTruthy()
    expect(screen.getByText('Subtítulo')).toBeTruthy()
    expect(screen.getByText('Contenido')).toBeTruthy()
    expect(screen.getByText('Guardar')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Cerrar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape y el clic en el fondo cierran', () => {
    const onClose = montar()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(document.body) // un mousedown fuera no cierra por sí solo
    fireEvent.click(document.querySelector('[aria-hidden="true"]')!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('bloquea el scroll del fondo mientras está abierto y lo restaura al cerrar', () => {
    const { unmount } = render(
      <Modal title="T" onClose={vi.fn()}>
        <p>x</p>
      </Modal>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('con un popover abierto dentro, Escape cierra el popover y NO el modal', () => {
    const onClose = vi.fn()
    render(
      <Modal title="T" onClose={onClose}>
        <SelectField
          ariaLabel="Origen"
          value=""
          onChange={vi.fn()}
          options={[{ value: 'a', label: 'Opción A' }]}
        />
      </Modal>,
    )
    fireEvent.click(screen.getByLabelText('Origen'))
    expect(screen.getByRole('listbox')).toBeTruthy()

    // Primer Escape: solo el popover (lo frena en captura).
    fireEvent.keyDown(screen.getByLabelText('Origen'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()

    // Segundo Escape: ahora sí, el modal.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('al abrir, el foco entra al primer control del cuerpo (no a la "X")', () => {
    render(
      <Modal title="T" onClose={vi.fn()} footer={<button type="button">Guardar</button>}>
        <button type="button">Primero</button>
        <button type="button">Segundo</button>
      </Modal>,
    )
    expect(document.activeElement).toBe(screen.getByText('Primero'))
  })

  it('al cerrar, el foco vuelve al elemento que abrió el modal', () => {
    const abridor = document.createElement('button')
    document.body.appendChild(abridor)
    abridor.focus()
    expect(document.activeElement).toBe(abridor)

    const { unmount } = render(
      <Modal title="T" onClose={vi.fn()}>
        <button type="button">Dentro</button>
      </Modal>,
    )
    expect(document.activeElement).toBe(screen.getByText('Dentro'))
    unmount()
    expect(document.activeElement).toBe(abridor)
    abridor.remove()
  })

  it('Tab desde el último control vuelve al primero, y Shift+Tab al revés', () => {
    render(
      <Modal title="T" onClose={vi.fn()} footer={<button type="button">Último</button>}>
        <button type="button">Primero</button>
      </Modal>,
    )
    // El panel tiene: X (cabecera) · Primero (cuerpo) · Último (pie). El foco
    // arranca en "Primero"; el ciclo va de la X al Último.
    const x = screen.getByLabelText('Cerrar')
    const ultimo = screen.getByText('Último')

    ultimo.focus()
    fireEvent.keyDown(ultimo, { key: 'Tab' })
    expect(document.activeElement).toBe(x)

    fireEvent.keyDown(x, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(ultimo)
  })

  it('con el foco en un popover portalizado (fuera del panel) no se atrapa Tab', () => {
    render(
      <Modal title="T" onClose={vi.fn()}>
        <SelectField ariaLabel="Origen" value="" onChange={vi.fn()} options={[{ value: 'a', label: 'A' }]} />
      </Modal>,
    )
    fireEvent.click(screen.getByLabelText('Origen'))
    const lista = screen.getByRole('listbox')
    // El Tab llega desde el portal (fuera del <dialog>): el modal no debe
    // secuestrarlo. No lanza y no mueve el foco al primer control del panel.
    expect(() => fireEvent.keyDown(lista, { key: 'Tab' })).not.toThrow()
  })

  it('el popover se renderiza en un portal fijo: fuera del panel del modal', () => {
    render(
      <Modal title="T" onClose={vi.fn()}>
        <SelectField ariaLabel="Origen" value="" onChange={vi.fn()} options={[{ value: 'a', label: 'A' }]} />
      </Modal>,
    )
    fireEvent.click(screen.getByLabelText('Origen'))
    const lista = screen.getByRole('listbox')
    // Hijo directo de <body> (portal) y con posición fija: ningún overflow lo recorta.
    expect(lista.parentElement).toBe(document.body)
    expect(lista.style.position).toBe('fixed')
    expect(screen.getByRole('dialog').contains(lista)).toBe(false)
  })
})

// ⚠ Dos modales se APILAN de verdad: una confirmación se pinta sobre el modal
// que la pidió (pasa al borrar un ámbito desde el modal de Ámbitos). El
// listener de Escape es de `document`, así que sin una pila la tecla llegaba a
// los dos: cancelabas la confirmación y se te iba la pantalla de detrás.
describe('Modales apilados', () => {
  const dos = () => {
    const cerrarFondo = vi.fn()
    const cerrarArriba = vi.fn()
    render(
      <>
        <Modal title="El de abajo" onClose={cerrarFondo}>
          <p>Fondo</p>
        </Modal>
        <Modal title="El de arriba" onClose={cerrarArriba}>
          <button type="button">Aceptar</button>
        </Modal>
      </>,
    )
    return { cerrarFondo, cerrarArriba }
  }

  it('Escape cierra SOLO el de arriba', () => {
    const { cerrarFondo, cerrarArriba } = dos()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(cerrarArriba).toHaveBeenCalledTimes(1)
    expect(cerrarFondo).not.toHaveBeenCalled()
  })

  it('el Tab lo atrapa el de arriba, no los dos', () => {
    dos()
    const arriba = screen.getByRole('dialog', { name: /El de arriba/ })
    const foco = arriba.querySelector('button')!
    foco.focus()
    // No revienta y el foco no se escapa al panel de debajo.
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(arriba.contains(document.activeElement)).toBe(true)
  })

  it('cerrar el de arriba NO devuelve el scroll a la página', () => {
    // Con dos apilados, el desmontaje del de arriba restauraba el overflow
    // guardado ANTES de abrirse (que era el del de abajo, ya "hidden"...) o el
    // original según el orden: la página de detrás volvía a hacer scroll con
    // un modal todavía abierto.
    const { unmount } = render(
      <Modal title="Abajo" onClose={vi.fn()}>
        <p>a</p>
      </Modal>,
    )
    const arriba = render(
      <Modal title="Arriba" onClose={vi.fn()}>
        <p>b</p>
      </Modal>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    arriba.unmount()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
