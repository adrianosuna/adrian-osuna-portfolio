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
