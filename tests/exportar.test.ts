// Exportación a Excel del año de ahorro (GET /app/finance/exportar): guarda
// de admin, año inexistente y generación real del .xlsx (exceljs, sin BD).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, getYearDetailMock, listYearsMock, gastosMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getYearDetailMock: vi.fn(),
  listYearsMock: vi.fn(),
  // Los tipos van explícitos: con `async () => []` TypeScript infiere
  // `never[]` y luego no deja poner una fila de prueba.
  gastosMock: {
    listCategorias: vi.fn<() => Promise<Record<string, unknown>[]>>(async () => []),
    listRecurrentes: vi.fn<() => Promise<Record<string, unknown>[]>>(async () => []),
    todosLosMovimientos: vi.fn<() => Promise<Record<string, unknown>[]>>(async () => []),
  },
}))

vi.mock('@/auth', () => ({ auth: authMock }))
vi.mock('@/lib/finance', () => ({
  getYearDetail: getYearDetailMock,
  listYears: listYearsMock,
}))
vi.mock('@/lib/gastos', () => gastosMock)

const { GET } = await import('@/app/app/finance/exportar/route')

const pedir = (year: string) => GET(new Request(`http://localhost/app/finance/exportar?year=${year}`))

const pedirTodo = () => GET(new Request('http://localhost/app/finance/exportar?todo=1'))

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { role: 'ADMIN' } })
  listYearsMock.mockResolvedValue([])
  gastosMock.listCategorias.mockResolvedValue([])
  gastosMock.listRecurrentes.mockResolvedValue([])
  gastosMock.todosLosMovimientos.mockResolvedValue([])
})

describe('GET /app/finance/exportar', () => {
  it('sin sesión o sin rol admin devuelve 403 y no toca datos', async () => {
    authMock.mockResolvedValue(null)
    expect((await pedir('2026')).status).toBe(403)
    authMock.mockResolvedValue({ user: { role: 'USER' } })
    expect((await pedir('2026')).status).toBe(403)
    expect(getYearDetailMock).not.toHaveBeenCalled()
  })

  it('año inexistente (o no numérico) devuelve 404', async () => {
    getYearDetailMock.mockResolvedValue(null)
    expect((await pedir('2099')).status).toBe(404)
    expect((await pedir('patata')).status).toBe(404)
  })

  it('genera un .xlsx real como adjunto con el nombre del año', async () => {
    getYearDetailMock.mockResolvedValue({
      year: { uuid: 'y26', year: 2026, goal: 9000 },
      months: [
        { month: 1, income: 2200, savingGeneral: 600, savingTravel: 150 },
        { month: 2, income: 2200, savingGeneral: 550, savingTravel: null },
      ],
      extras: [{ uuid: 'e1', concept: 'Paga extra', amount: 600 }],
      travels: [{ uuid: 't1', concept: 'Vuelos', amount: 400 }],
    })

    const res = await pedir('2026')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml')
    expect(res.headers.get('Content-Disposition')).toContain('ahorro-2026.xlsx')

    // Un .xlsx es un zip: firma PK al principio del cuerpo.
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(bytes.length).toBeGreaterThan(1000)
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')
  })
})

// Modo global (`?todo=1`): todo el módulo en un libro, para tener el dato fuera de la
// aplicación.
describe('GET /app/finance/exportar?todo=1', () => {
  const anio = (year: number) => ({
    uuid: `y-${year}`, year, goal: 14000, incomeTotal: 24000,
    monthsGeneral: 12000, monthsTravel: 1200, extrasTotal: 500, travelsTotal: 800,
    generalPorMes: [],
  })
  const detalle = (year: number) => ({
    year: { uuid: `y-${year}`, year, goal: 14000 },
    months: [], extras: [], travels: [],
  })

  it('la guarda de admin también protege el modo global', async () => {
    authMock.mockResolvedValue({ user: { role: 'USER' } })
    expect((await pedirTodo()).status).toBe(403)
    expect(listYearsMock).not.toHaveBeenCalled()
  })

  it('genera un .xlsx con el nombre fechado y sin caché', async () => {
    listYearsMock.mockResolvedValue([anio(2025), anio(2026)])
    getYearDetailMock.mockImplementation(async (y: number) => detalle(y))
    const res = await pedirTodo()
    expect(res.status).toBe(200)
    // El nombre lleva la FECHA y no un año: es una foto de todo, no de un año.
    expect(res.headers.get('content-disposition')).toMatch(
      /attachment; filename="finanzas-\d{4}-\d{2}-\d{2}\.xlsx"/,
    )
    // Son las finanzas personales del admin: que ningún intermediario cachee.
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 2).toString()).toBe('PK') // un .xlsx es un zip
  })

  it('trae una hoja por AÑO además de las cuatro fijas', async () => {
    listYearsMock.mockResolvedValue([anio(2025), anio(2026)])
    getYearDetailMock.mockImplementation(async (y: number) => detalle(y))
    const buf = Buffer.from(await (await pedirTodo()).arrayBuffer())
    // Los nombres de fichero de un zip van en claro: se cuentan las hojas.
    const hojas = new Set(buf.toString('latin1').match(/xl\/worksheets\/sheet\d+\.xml/g))
    // Resumen + 2 años + Movimientos + Categorías + Recurrentes.
    expect(hojas.size).toBe(6)
    expect(getYearDetailMock).toHaveBeenCalledTimes(2)
  })

  it('sin ningún año sigue exportando los datos de Gastos', async () => {
    // El módulo puede tener movimientos y categorías sin años de ahorro
    // creados; una exportación que fallara ahí no sería "de todo".
    gastosMock.todosLosMovimientos.mockResolvedValue([
      {
        expenseDate: '2026-09-01', type: 'GASTO', concept: 'Compra',
        categoria: 'Coche › Gasolina', amount: 70.2, note: null, deRecurrente: false,
      },
    ])
    const res = await pedirTodo()
    expect(res.status).toBe(200)
    const hojas = new Set(
      Buffer.from(await res.arrayBuffer()).toString('latin1').match(/xl\/worksheets\/sheet\d+\.xml/g),
    )
    expect(hojas.size).toBe(4) // Resumen + Movimientos + Categorías + Recurrentes
    expect(getYearDetailMock).not.toHaveBeenCalled()
  })
})
