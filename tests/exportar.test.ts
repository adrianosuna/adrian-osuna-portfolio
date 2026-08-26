// Exportación a Excel del año de ahorro (GET /app/finance/exportar): guarda
// de admin, año inexistente y generación real del .xlsx (exceljs, sin BD).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, getYearDetailMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getYearDetailMock: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: authMock }))
vi.mock('@/lib/finance', () => ({ getYearDetail: getYearDetailMock }))

const { GET } = await import('@/app/app/finance/exportar/route')

const pedir = (year: string) => GET(new Request(`http://localhost/app/finance/exportar?year=${year}`))

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { role: 'ADMIN' } })
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
