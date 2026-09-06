// @vitest-environment jsdom
// Calendario de días: lo que hay que probar es la INTERACCIÓN, porque la
// aritmética ya está cubierta en calendario.test.ts — pulsar un día vacío
// crea con esa fecha, pulsar una tarea la edita, un recurrente enlaza a su
// módulo, y los filtros nunca se apagan los tres.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Calendario } from '@/components/dashboard/panel/calendario'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)

const HOY = '2026-09-05'
const tareas = [
  { uuid: 't1', title: 'ITV del coche', scopeName: 'Vehículo', intervalMonths: 12, nextDue: '2026-09-20', lastDone: null },
]
const recurrentes = [
  {
    uuid: 'r1', concept: 'Alquiler', type: 'GASTO' as const, amount: 720,
    intervalMonths: 1, nextDate: '2026-09-03', dayAnchor: 3, active: true,
  },
]
const seguimientos = [
  {
    uuid: 'o1', title: 'Web corporativa', company: 'ACME',
    nextAction: 'Enviar propuesta', nextActionDate: '2026-09-15', archived: false,
  },
]

function montar(extra: Partial<Parameters<typeof Calendario>[0]> = {}) {
  const props = {
    hoy: HOY,
    tareas,
    recurrentes,
    seguimientos,
    onNuevaTarea: vi.fn(),
    onAbrirTarea: vi.fn(),
    onAbrirEvento: vi.fn(),
    ...extra,
  }
  render(<Calendario {...props} />)
  return props
}

/** Celda de un día por su nombre accesible (que lleva la fecha larga). */
const dia = (n: number) =>
  screen.getByRole('button', { name: new RegExp(`, ${n} de septiembre de 2026`) })

/**
 * El panel de detalle del día.
 *
 * ⚠ Las consultas van acotadas AQUÍ y no a `screen`: el título de un evento
 * está también en su celda de la rejilla, y jsdom no aplica el `hidden` de
 * Tailwind — así que buscar por texto suelto encuentra dos.
 */
const detalle = () => within(screen.getByRole('list'))

describe('Calendario', () => {
  it('empieza en el mes de hoy, con la semana en lunes', () => {
    montar()
    expect(screen.getByText('Septiembre 2026')).toBeTruthy()
    // La primera columna es lunes: el nombre está en el DOM, que es lo que lo
    // hace legible para un lector de pantalla.
    expect(screen.getByText('Lunes')).toBeTruthy()
  })

  it('la cabecera lleva el nombre completo del día y su abreviatura', () => {
    montar()
    // Las dos versiones se pintan y el CSS decide cuál se VE según el ancho.
    // ⚠ El nombre largo va en el DOM (con `sr-only` en móvil) y no en un
    // `aria-label` del div: en un div sin rol, ese atributo no existe.
    for (const d of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      expect(screen.getByText(d)).toBeTruthy()
    }
    expect(screen.getByText('Mié')).toBeTruthy()
    // Y nadie se apoya ya en el aria-label que no funcionaba.
    expect(screen.queryByLabelText('Miércoles')).toBeNull()
  })

  it('pulsar un día VACÍO da de alta una tarea con esa fecha', () => {
    const p = montar()
    fireEvent.click(dia(18))
    expect(p.onNuevaTarea).toHaveBeenCalledWith('2026-09-18')
  })

  it('pulsar un día con eventos abre su detalle, no el alta', () => {
    const p = montar()
    fireEvent.click(dia(20))
    expect(p.onNuevaTarea).not.toHaveBeenCalled()
    expect(screen.getByText(/20 de septiembre de 2026/)).toBeTruthy()
    expect(detalle().getByText('ITV del coche')).toBeTruthy()
  })

  it('desde el detalle, una tarea se edita y un recurrente va a su módulo', () => {
    const p = montar()
    fireEvent.click(dia(20))
    fireEvent.click(detalle().getByText('ITV del coche'))
    expect(p.onAbrirTarea).toHaveBeenCalledWith('t1')

    cleanup()
    const q = montar()
    fireEvent.click(dia(3))
    fireEvent.click(detalle().getByText('Alquiler'))
    // Un recurrente NO se edita aquí: sus reglas viven en su módulo.
    expect(q.onAbrirTarea).not.toHaveBeenCalled()
    expect(q.onAbrirEvento).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'recurrente', refUuid: 'r1' }))
  })

  it('el detalle de un día sin eventos ofrece crear ahí', () => {
    const p = montar({ tareas: [], recurrentes: [], seguimientos: [] })
    // Sin eventos el clic va directo al alta; el panel se abre desde un día
    // que sí tenga, así que aquí se comprueba el camino corto.
    fireEvent.click(dia(10))
    expect(p.onNuevaTarea).toHaveBeenCalledWith('2026-09-10')
  })

  it('navega de mes y «Hoy» solo aparece fuera del mes en curso', () => {
    montar()
    expect(screen.queryByText('Hoy')).toBeNull()
    fireEvent.click(screen.getByLabelText('Mes siguiente'))
    expect(screen.getByText('Octubre 2026')).toBeTruthy()
    fireEvent.click(screen.getByText('Hoy'))
    expect(screen.getByText('Septiembre 2026')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Mes anterior'))
    expect(screen.getByText('Agosto 2026')).toBeTruthy()
  })

  it('los filtros por tipo ocultan eventos, pero nunca se apagan los tres', () => {
    montar()
    const chip = (t: string) => screen.getByRole('button', { name: new RegExp(`^${t}`) })
    fireEvent.click(chip('Mantenimiento'))
    fireEvent.click(chip('Seguimiento'))
    fireEvent.click(chip('Recurrente'))
    // El último se queda encendido: un calendario vacío no informa de nada.
    expect(chip('Recurrente').getAttribute('aria-pressed')).toBe('true')
    expect(chip('Mantenimiento').getAttribute('aria-pressed')).toBe('false')
  })

  it('una tarea vencida se ve en hoy y marcada', () => {
    montar({
      tareas: [{ uuid: 'v1', title: 'Caldera', scopeName: 'Casa', intervalMonths: null, nextDue: '2026-06-01', lastDone: null }],
    })
    fireEvent.click(dia(5))
    expect(detalle().getByText('Caldera')).toBeTruthy()
    expect(detalle().getByText('Vencido')).toBeTruthy()
  })
})

// ⚠ Las 35 celdas son botones: sin tabindex rotatorio, cruzar el calendario con
// el tabulador eran 35 paradas. Solo una entra en el orden y desde ella se
// navega con las flechas, como en cualquier rejilla de fechas.
describe('Calendario: teclado', () => {
  const celda = (fecha: string) =>
    document.querySelector<HTMLButtonElement>(`[data-fecha="${fecha}"]`)!

  it('una sola parada de tabulador, y es hoy', () => {
    montar()
    const conFoco = [...document.querySelectorAll<HTMLElement>('[data-fecha]')].filter(
      (b) => b.tabIndex === 0,
    )
    expect(conFoco).toHaveLength(1)
    expect(conFoco[0].dataset.fecha).toBe(HOY)
  })

  it('las flechas mueven el foco por día y por semana', () => {
    montar()
    celda('2026-09-05').focus()
    fireEvent.keyDown(celda('2026-09-05'), { key: 'ArrowRight' })
    expect((document.activeElement as HTMLElement).dataset.fecha).toBe('2026-09-06')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect((document.activeElement as HTMLElement).dataset.fecha).toBe('2026-09-13')
    // Inicio va al lunes de esa semana (el 13 es domingo).
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect((document.activeElement as HTMLElement).dataset.fecha).toBe('2026-09-07')
  })

  it('salir del mes con una flecha cambia de mes y se lleva el foco', () => {
    montar()
    celda('2026-09-01').focus()
    fireEvent.keyDown(celda('2026-09-01'), { key: 'ArrowLeft' })
    expect(screen.getByText('Agosto 2026')).toBeTruthy()
    expect((document.activeElement as HTMLElement).dataset.fecha).toBe('2026-08-31')
  })

  it('un día VECINO lleva a su mes: en la rejilla del mes en curso sale vacío', () => {
    montar()
    // La celda del 31 de agosto no puede enseñar lo de ese día (los eventos
    // están acotados al mes), así que lleva a donde sí se ve.
    expect(celda('2026-08-31').getAttribute('aria-label')).toContain('ir a ese mes')
    fireEvent.click(celda('2026-08-31'))
    expect(screen.getByText('Agosto 2026')).toBeTruthy()
  })

  it('solo son conmutador las celdas que abren el detalle', () => {
    montar()
    // Con eventos: abre y cierra, así que aria-pressed dice algo.
    expect(celda('2026-09-20').getAttribute('aria-pressed')).toBe('false')
    // Vacía (da de alta) y vecina (cambia de mes): anunciarlas como "no
    // pulsado" sería mentir sobre lo que hace el clic.
    expect(celda('2026-09-18').hasAttribute('aria-pressed')).toBe(false)
    expect(celda('2026-08-31').hasAttribute('aria-pressed')).toBe(false)
  })
})
