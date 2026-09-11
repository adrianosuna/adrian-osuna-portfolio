// @vitest-environment jsdom
// Lista de Mantenimiento: orden de las tareas, chips de ámbito, acción principal de
// cada fila y que el "no hay nada" sea de la lista.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { auditar } from './axe'

const completeMaintenance = vi.fn(async () => ({ ok: true }))
const reopenMaintenance = vi.fn(async () => ({ ok: true }))
const createAmbito = vi.fn(async () => ({ ok: true }))
const updateAmbito = vi.fn(async () => ({ ok: true }))
const deleteAmbito = vi.fn(async () => ({ ok: true }))
const createMaintenance = vi.fn<(datos: Record<string, unknown>) => Promise<{ ok: boolean }>>(
  async () => ({ ok: true }),
)
/** Respuesta del diálogo de confirmación; cada test la fija. El tipo del
 *  argumento importa: los tests comprueban la `clave` con la que se llama. */
const confirmarMock = vi.fn<(o: { clave?: string; titulo: string; texto: string }) => Promise<boolean>>(
  async () => true,
)

vi.mock('@/app/app/panel/actions', () => ({
  completeMaintenance,
  reopenMaintenance,
  createAmbito,
  updateAmbito,
  deleteAmbito,
  createMaintenance,
  deleteMaintenance: vi.fn(),
  updateMaintenance: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/dashboard/confirmar', () => ({ useConfirmar: () => confirmarMock }))
vi.mock('@/components/dashboard/barra-carga', () => ({ useCarga: () => vi.fn() }))

const { MantenimientoTab } = await import('@/components/dashboard/panel/mantenimiento')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  confirmarMock.mockResolvedValue(true)
})

type Props = Parameters<typeof MantenimientoTab>[0]

const HOY = '2026-09-05'
const AMBITOS = [
  { uuid: 'a-casa', name: 'Casa', tareas: 1 },
  { uuid: 'a-serv', name: 'Servidor', tareas: 1 },
  { uuid: 'a-vacio', name: 'Vehículo', tareas: 0 },
]

const tarea = (p: Partial<Props['rows'][number]> = {}): Props['rows'][number] => ({
  uuid: 't1', title: 'ITV', scopeUuid: 'a-casa', scopeName: 'Casa', notes: null,
  intervalMonths: 12, nextDue: '2026-12-01', lastDone: null, ...p,
})

const montar = (extra: Partial<Props> = {}) =>
  render(
    <MantenimientoTab rows={[tarea()]} ambitos={AMBITOS} hoy={HOY} smtpListo vista="lista" {...extra} />,
  )

/** Los títulos de las filas, en el orden en que se pintan. */
const titulos = () =>
  within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('p')!.textContent)

/** Los chips del filtro por ámbito (no existe con un solo ámbito en uso). */
const filtros = () => within(screen.getByRole('group', { name: 'Filtrar por ámbito' }))

describe('Lista de mantenimiento: orden y marcado', () => {
  it('lo CUMPLIDO se hunde, aunque su fecha sea la más antigua', () => {
    // La consulta ordena por nextDue y una puntual cumplida salía la primera con su chip
    // apagado.
    montar({
      rows: [
        tarea({ uuid: 'h', title: 'Dominio renovado', intervalMonths: null, nextDue: '2026-03-01', lastDone: '2026-03-02' }),
        tarea({ uuid: 'v', title: 'Caldera', nextDue: '2026-09-01' }),
        tarea({ uuid: 'f', title: 'Backups', nextDue: '2026-10-01' }),
      ],
    })
    expect(titulos()).toEqual(['Caldera', 'Backups', 'Dominio renovado'])
  })

  it('es una lista de verdad, con una fila por tarea', () => {
    montar({ rows: [tarea({ uuid: 'a' }), tarea({ uuid: 'b', title: 'Backups' })] })
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2)
  })
})

describe('Lista de mantenimiento: filtro por ámbito', () => {
  const dos = [
    tarea({ uuid: 'a', title: 'Caldera', scopeUuid: 'a-casa', scopeName: 'Casa' }),
    tarea({ uuid: 'b', title: 'Backups', scopeUuid: 'a-serv', scopeName: 'Servidor' }),
  ]

  it('solo llevan chip los ámbitos EN USO', () => {
    montar({ rows: dos })
    expect(filtros().getByRole('button', { name: 'Casa' })).toBeTruthy()
    expect(filtros().getByRole('button', { name: 'Servidor' })).toBeTruthy()
    // Vehículo existe como ámbito pero no lo usa ninguna tarea: su chip daba
    // un filtro que no encontraba nada.
    expect(filtros().queryByRole('button', { name: 'Vehículo' })).toBeNull()
  })

  it('una tarea sin ámbito es alcanzable por su propio chip', () => {
    montar({ rows: [...dos, tarea({ uuid: 'c', title: 'Huérfana', scopeUuid: null, scopeName: null })] })
    fireEvent.click(filtros().getByRole('button', { name: 'Sin ámbito' }))
    expect(titulos()).toEqual(['Huérfana'])
  })

  it('filtrar acota la lista', () => {
    montar({ rows: dos })
    fireEvent.click(filtros().getByRole('button', { name: 'Casa' }))
    expect(titulos()).toEqual(['Caldera'])
  })
})

describe('Lista de mantenimiento: la acción de la fila', () => {
  it('una que se repite se marca hecha y encadena', () => {
    montar({ rows: [tarea({ uuid: 'r', intervalMonths: 12 })] })
    // Por su nombre accesible: el texto visible es `sm:hidden`, así que en escritorio
    // solo puede venir del `aria-label`.
    fireEvent.click(screen.getByRole('button', { name: 'Marcar ITV como hecha' }))
    expect(completeMaintenance).toHaveBeenCalledWith('r')
  })

  it('una puntual CUMPLIDA ofrece Reabrir, no volver a marcarla', () => {
    // "Hecha" es un clic sin confirmación y en una puntual era una puerta de
    // una sola dirección: sin esto, la única salida era borrarla y reescribirla.
    montar({ rows: [tarea({ uuid: 'p', intervalMonths: null, nextDue: '2026-03-01', lastDone: '2026-03-02' })] })
    expect(screen.queryByRole('button', { name: /Marcar .* como hecha/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir ITV' }))
    expect(reopenMaintenance).toHaveBeenCalledWith('p')
  })

  it('la puntual cumplida lleva chip «Hecha» y no un vencimiento', () => {
    montar({ rows: [tarea({ uuid: 'p', intervalMonths: null, nextDue: '2026-03-01', lastDone: '2026-03-02' })] })
    // El chip se pinta dos veces (móvil y sm) y jsdom no aplica el `hidden`: se
    // encuentran las dos. Ninguna debe ser un vencimiento.
    expect(screen.getAllByText('Hecha')).toHaveLength(2)
    expect(screen.queryByText(/Hace \d+ meses/)).toBeNull()
  })
})

describe('Lista de mantenimiento: el vacío es de la LISTA', () => {
  it('sin tareas, la lista avisa', () => {
    montar({ rows: [] })
    expect(screen.getByText(/Sin tareas todavía/)).toBeTruthy()
  })

  it('sin tareas, el CALENDARIO se sigue viendo', () => {
    // El aviso iba delante y tapaba la rejilla entera con sus recurrentes y seguimientos.
    montar({
      rows: [],
      vista: 'calendario',
      recurrentes: [
        {
          uuid: 'r1', concept: 'Alquiler', type: 'GASTO', amount: 720,
          intervalMonths: 1, nextDate: '2026-09-03', dayAnchor: 3, active: true,
        },
      ],
    })
    expect(screen.queryByText(/Sin tareas todavía/)).toBeNull()
    expect(screen.getByText('Septiembre 2026')).toBeTruthy()
    expect(screen.getByText('Alquiler')).toBeTruthy()
  })
})

// La auditoría axe va aquí porque montar la pestaña arrastra sus server actions. Está
// por el botón «Hecha», que en escritorio no tenía nombre accesible.
describe('axe: la lista y sus acciones', () => {
  it('sin violaciones, con una tarea pendiente y una cumplida', async () => {
    const { baseElement } = montar({
      rows: [
        tarea({ uuid: 't1', title: 'Revisión de la caldera', notes: 'Guardar el certificado', nextDue: HOY }),
        tarea({
          uuid: 't2', title: 'Renovar el dominio', scopeUuid: 'a-serv', scopeName: 'Servidor',
          intervalMonths: null, nextDue: '2026-03-01', lastDone: '2026-03-02',
        }),
      ],
    })
    expect(await auditar(baseElement)).toEqual([])
  })
})

// Modal de Ámbitos: un ámbito en uso no se borra, el vacío pide confirmación y el
// nombre no puede irse en blanco.
describe('Modal de Ámbitos', () => {
  const abrir = (extra: Partial<Props> = {}) => {
    montar(extra)
    fireEvent.click(screen.getByRole('button', { name: 'Ámbitos' }))
    return within(screen.getByRole('dialog', { name: /Ámbitos de mantenimiento/ }))
  }

  it('lista los ámbitos con su cuenta de tareas, en una lista de verdad', () => {
    const m = abrir()
    // La cuenta viene del servidor (`_count`), en singular/plural, y el vacío
    // se lee "sin tareas" (es el único que se puede borrar).
    expect(m.getAllByText('1 tarea')).toHaveLength(2)
    expect(m.getByText('sin tareas')).toBeTruthy()
    expect(m.getAllByRole('listitem')).toHaveLength(3)
  })

  it('un ámbito EN USO no se borra: ni confirma ni llama a la action', () => {
    const m = abrir()
    fireEvent.click(m.getByRole('button', { name: 'Eliminar Casa' }))
    expect(confirmarMock).not.toHaveBeenCalled()
    expect(deleteAmbito).not.toHaveBeenCalled()
  })

  it('uno VACÍO pide confirmación antes de borrarlo', async () => {
    const m = abrir()
    fireEvent.click(m.getByRole('button', { name: 'Eliminar Vehículo' }))
    await vi.waitFor(() => expect(confirmarMock).toHaveBeenCalled())
    expect(confirmarMock.mock.calls[0][0]).toMatchObject({ clave: 'borrar-ambito' })
    await vi.waitFor(() => expect(deleteAmbito).toHaveBeenCalledWith('a-vacio'))
  })

  it('si se cancela la confirmación, no se borra', async () => {
    confirmarMock.mockResolvedValue(false)
    const m = abrir()
    fireEvent.click(m.getByRole('button', { name: 'Eliminar Vehículo' }))
    await vi.waitFor(() => expect(confirmarMock).toHaveBeenCalled())
    expect(deleteAmbito).not.toHaveBeenCalled()
  })

  it('renombrar con el nombre en blanco no sale, ni con Enter', () => {
    const m = abrir()
    fireEvent.click(m.getByRole('button', { name: 'Renombrar Casa' }))
    const campo = m.getByLabelText('Nombre de Casa')
    fireEvent.change(campo, { target: { value: '   ' } })
    // El botón está apagado...
    expect(m.getByRole('button', { name: 'Guardar' })).toHaveProperty('disabled', true)
    // ...y el Enter, que se lo saltaba y mandaba el vacío al servidor, también.
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(updateAmbito).not.toHaveBeenCalled()
    fireEvent.change(campo, { target: { value: 'Hogar' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(updateAmbito).toHaveBeenCalledWith('a-casa', { name: 'Hogar' })
  })

  it('crear tampoco admite el vacío', () => {
    const m = abrir()
    const campo = m.getByLabelText('Nombre del ámbito nuevo')
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(createAmbito).not.toHaveBeenCalled()
    fireEvent.change(campo, { target: { value: 'Bici' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(createAmbito).toHaveBeenCalledWith({ name: 'Bici' })
  })
})

// Modal de alta/edición: el borrador separa `repite` de `intervalMonths`, porque
// null era a la vez "no se repite" y "vacío mientras escribo".
describe('Modal de nueva tarea', () => {
  const abrir = () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }))
    return within(screen.getByRole('dialog', { name: /Nueva tarea de mantenimiento/ }))
  }
  const meses = (m: ReturnType<typeof abrir>) => m.queryByLabelText('Periodicidad en meses')

  it('vaciar «Cada (meses)» NO convierte la tarea en puntual', () => {
    // Antes el campo desaparecía bajo el cursor y se guardaba una puntual creyendo que
    // era mensual.
    const m = abrir()
    fireEvent.change(meses(m)!, { target: { value: '' } })
    expect(meses(m)).not.toBeNull()
    expect(m.getByLabelText('Repetición de la tarea').textContent).toContain('Se repite')
    expect(m.getByText('Próximo vencimiento *')).toBeTruthy()
  })

  it('...y con el campo vacío no se puede guardar', () => {
    const m = abrir()
    fireEvent.change(meses(m)!, { target: { value: '' } })
    expect(m.getByRole('button', { name: 'Crear' })).toHaveProperty('disabled', true)
    fireEvent.change(meses(m)!, { target: { value: '3' } })
    fireEvent.change(m.getByLabelText('Tarea'), { target: { value: 'ITV' } })
    expect(m.getByRole('button', { name: 'Crear' })).toHaveProperty('disabled', false)
  })

  it('los meses fuera de 1-120 se avisan aquí, sin ir al servidor', () => {
    const m = abrir()
    fireEvent.change(m.getByLabelText('Tarea'), { target: { value: 'ITV' } })
    fireEvent.change(meses(m)!, { target: { value: '0' } })
    expect(m.getByText(/Entre 1 y 120 meses/)).toBeTruthy()
    expect(m.getByRole('button', { name: 'Crear' })).toHaveProperty('disabled', true)
    fireEvent.change(meses(m)!, { target: { value: '121' } })
    expect(m.getByRole('button', { name: 'Crear' })).toHaveProperty('disabled', true)
    fireEvent.change(meses(m)!, { target: { value: '120' } })
    expect(m.queryByText(/Entre 1 y 120 meses/)).toBeNull()
    expect(m.getByRole('button', { name: 'Crear' })).toHaveProperty('disabled', false)
  })

  it('«Una vez» esconde los meses y renombra la fecha', () => {
    const m = abrir()
    fireEvent.click(m.getByLabelText('Repetición de la tarea'))
    fireEvent.click(screen.getByRole('option', { name: 'Una vez' }))
    expect(meses(m)).toBeNull()
    expect(m.getByText('Fecha *')).toBeTruthy()
    // Y sin periodicidad que pedir, se puede guardar solo con título y fecha.
    fireEvent.change(m.getByLabelText('Tarea'), { target: { value: 'Renovar dominio' } })
    expect(m.getByRole('button', { name: 'Crear' })).toHaveProperty('disabled', false)
  })
})

describe('Modal de nueva tarea: Enter guarda', () => {
  const abrir = () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }))
    return within(screen.getByRole('dialog', { name: /Nueva tarea de mantenimiento/ }))
  }

  it('desde el título, con el formulario ya válido', () => {
    const m = abrir()
    fireEvent.change(m.getByLabelText('Tarea'), { target: { value: 'Revisar la caldera' } })
    fireEvent.keyDown(m.getByLabelText('Tarea'), { key: 'Enter' })
    expect(createMaintenance).toHaveBeenCalledTimes(1)
    expect(createMaintenance.mock.calls[0][0]).toMatchObject({
      title: 'Revisar la caldera', intervalMonths: 1, scopeUuid: 'a-casa',
    })
  })

  it('y desde «Cada (meses)», que es el otro campo de una línea', () => {
    const m = abrir()
    fireEvent.change(m.getByLabelText('Tarea'), { target: { value: 'ITV' } })
    fireEvent.keyDown(m.getByLabelText('Periodicidad en meses'), { key: 'Enter' })
    expect(createMaintenance).toHaveBeenCalledTimes(1)
    expect(createMaintenance.mock.calls[0][0]).toMatchObject({ intervalMonths: 1 })
  })

  it('con el formulario a medias no manda nada', () => {
    const m = abrir()
    // Sin título: el botón está apagado, y el Enter tiene que respetarlo.
    fireEvent.keyDown(m.getByLabelText('Tarea'), { key: 'Enter' })
    expect(createMaintenance).not.toHaveBeenCalled()
    // Y con los meses fuera de rango, tampoco.
    fireEvent.change(m.getByLabelText('Tarea'), { target: { value: 'ITV' } })
    fireEvent.change(m.getByLabelText('Periodicidad en meses'), { target: { value: '0' } })
    fireEvent.keyDown(m.getByLabelText('Tarea'), { key: 'Enter' })
    expect(createMaintenance).not.toHaveBeenCalled()
  })

  it('el Enter de las NOTAS no guarda: ahí es un salto de línea', () => {
    const m = abrir()
    fireEvent.change(m.getByLabelText('Tarea'), { target: { value: 'ITV' } })
    fireEvent.keyDown(m.getByLabelText('Notas'), { key: 'Enter' })
    expect(createMaintenance).not.toHaveBeenCalled()
  })
})
