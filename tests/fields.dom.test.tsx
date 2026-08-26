// @vitest-environment jsdom
// Campos de formulario custom (fields.tsx) renderizados de verdad: parseo
// decimal con coma o punto, flechas y teclado del NumberField (paso, suelo en
// cero), popover del SelectField y calendario del DateField (semana empezando
// en lunes, "Hoy", "Borrar").
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DateField, NumberField, SelectField } from '@/components/ui/fields'

// Testing Library necesita saber que está en un entorno con act().
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(cleanup)

describe('NumberField', () => {
  const montar = (value: number | null, step = 50) => {
    const onChange = vi.fn()
    render(<NumberField value={value} onChange={onChange} ariaLabel="Importe" step={step} />)
    return { onChange, input: screen.getByLabelText('Importe') as HTMLInputElement }
  }

  it('acepta coma o punto como separador decimal', () => {
    const { onChange, input } = montar(null)
    fireEvent.change(input, { target: { value: '12,5' } })
    expect(onChange).toHaveBeenLastCalledWith(12.5)
    expect(input.value).toBe('12,5')
    fireEvent.change(input, { target: { value: '7.25' } })
    expect(onChange).toHaveBeenLastCalledWith(7.25)
  })

  it('filtra caracteres no numéricos y separadores de más', () => {
    const { onChange, input } = montar(null)
    fireEvent.change(input, { target: { value: 'abc12x' } })
    expect(input.value).toBe('12')
    expect(onChange).toHaveBeenLastCalledWith(12)
    fireEvent.change(input, { target: { value: '12,5.7' } })
    expect(input.value).toBe('12,57') // solo el primer separador sobrevive
    expect(onChange).toHaveBeenLastCalledWith(12.57)
  })

  it('vaciar el campo emite null (mes sin rellenar), no cero', () => {
    const { onChange, input } = montar(100)
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('las flechas del teclado suben y bajan según el paso', () => {
    const { onChange, input } = montar(100)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(150)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(50)
  })

  it('suelo en cero: bajar desde 0 (o desde vacío) se queda en 0', () => {
    const { onChange, input } = montar(0)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(0)
    cleanup()
    const vacio = montar(null)
    fireEvent.keyDown(vacio.input, { key: 'ArrowDown' })
    expect(vacio.onChange).toHaveBeenLastCalledWith(0)
  })

  it('los botones de flecha incrementan con redondeo a céntimos', () => {
    const onChange = vi.fn()
    render(<NumberField value={0.1} onChange={onChange} ariaLabel="Importe" step={0.2} />)
    fireEvent.click(screen.getByLabelText('Incrementar'))
    expect(onChange).toHaveBeenLastCalledWith(0.3) // no 0.30000000000000004
  })
})

describe('SelectField', () => {
  it('abre el popover, marca la opción activa y emite al elegir', () => {
    const onChange = vi.fn()
    render(
      <SelectField
        ariaLabel="Origen"
        value="a"
        onChange={onChange}
        options={[{ value: 'a', label: 'Opción A' }, { value: 'b', label: 'Opción B' }]}
      />,
    )
    fireEvent.click(screen.getByLabelText('Origen'))
    const opciones = screen.getAllByRole('option')
    expect(opciones).toHaveLength(2)
    expect(opciones[0]).toHaveProperty('ariaSelected', 'true')
    fireEvent.click(screen.getByText('Opción B'))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('listbox')).toBeNull() // se cierra al elegir
  })
})

describe('DateField', () => {
  it('muestra dd/mm/yyyy, abre en el mes seleccionado y la semana empieza en lunes', () => {
    render(<DateField ariaLabel="Fecha" value="2026-08-10" onChange={vi.fn()} />)
    const boton = screen.getByLabelText('Fecha')
    expect(boton.textContent).toContain('10/08/2026')
    fireEvent.click(boton)
    expect(screen.getByText('Agosto 2026')).toBeTruthy()
    // Cabecera de días: L M X J V S D (lunes primero).
    const dialogo = screen.getByRole('dialog')
    const cabecera = [...dialogo.querySelectorAll('.grid > span')].slice(0, 7).map((s) => s.textContent)
    expect(cabecera).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D'])
  })

  it('elegir un día emite YYYY-MM-DD y cierra; agosto de 2026 tiene 31 botones', () => {
    const onChange = vi.fn()
    render(<DateField ariaLabel="Fecha" value="2026-08-10" onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Fecha'))
    const dias = screen.getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent ?? ''))
    expect(dias).toHaveLength(31)
    fireEvent.click(screen.getByText('25'))
    expect(onChange).toHaveBeenCalledWith('2026-08-25')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('navega de mes (con cambio de año) y "Borrar" vacía el valor', () => {
    const onChange = vi.fn()
    render(<DateField ariaLabel="Fecha" value="2026-01-15" onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Fecha'))
    fireEvent.click(screen.getByLabelText('Mes anterior'))
    expect(screen.getByText('Diciembre 2025')).toBeTruthy()
    fireEvent.click(screen.getByText('Borrar'))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('"Hoy" emite la fecha actual', () => {
    const onChange = vi.fn()
    render(<DateField ariaLabel="Fecha" value="" onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Fecha'))
    fireEvent.click(screen.getByText('Hoy'))
    const h = new Date()
    const esperado = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
    expect(onChange).toHaveBeenCalledWith(esperado)
  })
})
