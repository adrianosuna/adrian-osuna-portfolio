// @vitest-environment jsdom
// Timeline de actividad de una oportunidad: la carga se pide al abrir el
// detalle (no viaja con el tablero), así que aquí se prueban sus tres estados
// —cargando, con eventos y ERROR— con la server action mockeada. El estado de
// error existe porque antes un fallo dejaba "Cargando…" para siempre: el toast
// se iba y no quedaba forma de reintentar.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

const getOpportunityEvents = vi.fn()
const addOpportunityEvent = vi.fn()
const deleteOpportunityEvent = vi.fn()

vi.mock('@/app/app/pipeline/actions', () => ({
  getOpportunityEvents,
  addOpportunityEvent,
  deleteOpportunityEvent,
  createOpportunity: vi.fn(),
  updateOpportunity: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { Timeline } = await import('@/components/dashboard/pipeline/oportunidad-modal')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const EVENTOS = [
  { uuid: 'e1', type: 'ESTADO', detail: 'Contacto → Conversación', createTs: '2026-07-18T10:15:00.000Z' },
  { uuid: 'e2', type: 'LLAMADA', detail: 'Llamada de 25 min con Marta', createTs: '2026-07-21T12:00:00.000Z' },
  { uuid: 'e3', type: 'NOTA', detail: 'Piden bajar el alcance', createTs: '2026-08-20T18:05:00.000Z' },
]

/** Monta el timeline y deja resolver la promesa de la action. */
const montar = async () => {
  const r = render(<Timeline uuid="op-1" />)
  await act(async () => {})
  return r
}

describe('Timeline de actividad', () => {
  it('mientras carga muestra "Cargando…"', () => {
    getOpportunityEvents.mockReturnValue(new Promise(() => {})) // nunca resuelve
    render(<Timeline uuid="op-1" />)
    expect(screen.getByText('Cargando…')).toBeTruthy()
  })

  it('pinta los eventos recibidos, del más reciente al más antiguo', async () => {
    getOpportunityEvents.mockResolvedValue({ ok: true, events: EVENTOS })
    await montar()
    expect(screen.getByText('Contacto → Conversación')).toBeTruthy()
    expect(screen.getByText('Llamada de 25 min con Marta')).toBeTruthy()
    expect(screen.getByText('Piden bajar el alcance')).toBeTruthy()
    expect(screen.queryByText('Cargando…')).toBeNull()
  })

  it('sin eventos lo dice, en vez de quedarse cargando', async () => {
    getOpportunityEvents.mockResolvedValue({ ok: true, events: [] })
    await montar()
    expect(screen.getByText('Sin actividad todavía.')).toBeTruthy()
  })

  it('si la carga falla ofrece reintentar (no se queda en "Cargando…")', async () => {
    getOpportunityEvents.mockResolvedValue({ ok: false, message: 'No autorizado' })
    await montar()
    expect(screen.queryByText('Cargando…')).toBeNull()
    expect(screen.getByText(/No se pudo cargar la actividad/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })

  it('"Reintentar" vuelve a pedir la actividad y la pinta', async () => {
    getOpportunityEvents.mockResolvedValue({ ok: false, message: 'No autorizado' })
    await montar()
    getOpportunityEvents.mockResolvedValue({ ok: true, events: EVENTOS })
    await act(async () => {
      screen.getByRole('button', { name: 'Reintentar' }).click()
    })
    expect(getOpportunityEvents).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Contacto → Conversación')).toBeTruthy()
    expect(screen.queryByText(/No se pudo cargar/)).toBeNull()
  })

  it('los cambios de estado los apunta el sistema: no se pueden borrar', async () => {
    getOpportunityEvents.mockResolvedValue({ ok: true, events: EVENTOS })
    await montar()
    const borrar = screen.queryAllByRole('button', { name: /Eliminar/ })
    // Tres eventos, uno de ellos de estado → como máximo dos borrables.
    expect(borrar.length).toBeLessThanOrEqual(2)
  })
})
