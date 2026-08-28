// Movimientos recurrentes: la aritmética de fechas (que es donde están todas
// las trampas: meses cortos, febrero, cruce de año), la recuperación de cargos
// atrasados, el generador del cron, el botón "Apuntar ahora" y el listado de lo
// que ha generado cada recurrente.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cargosPendientes,
  equivalenteMensual,
  etiquetaPeriodo,
  MAX_CARGOS,
  proximaFecha,
  resumenRecurrentes,
  type RecurrenteRow,
} from '@/lib/recurrentes'
import { sumarMeses } from '@/lib/fechas'

const rec = (p: Partial<RecurrenteRow> = {}): RecurrenteRow => ({
  uuid: 'r1',
  type: 'GASTO',
  concept: 'Alquiler',
  amount: 720,
  intervalMonths: 1,
  nextDate: '2026-08-03',
  dayAnchor: 3,
  active: true,
  lastCreated: null,
  categoryUuid: 'c1',
  generados: 0,
  ...p,
})

describe('sumarMeses', () => {
  it('suma meses conservando el día', () => {
    expect(sumarMeses('2026-08-03', 1)).toBe('2026-09-03')
    expect(sumarMeses('2026-08-03', 3)).toBe('2026-11-03')
  })

  it('cruza el año', () => {
    expect(sumarMeses('2026-11-15', 3)).toBe('2027-02-15')
    expect(sumarMeses('2026-12-31', 1, 31)).toBe('2027-01-31')
    expect(sumarMeses('2026-03-20', 12)).toBe('2027-03-20')
  })

  it('recorta el día al último del mes cuando no existe', () => {
    expect(sumarMeses('2026-01-31', 1, 31)).toBe('2026-02-28')
    expect(sumarMeses('2026-05-31', 1, 31)).toBe('2026-06-30')
    // 2028 es bisiesto.
    expect(sumarMeses('2028-01-30', 1, 30)).toBe('2028-02-29')
  })

  it('el ancla recupera el día original después de un mes corto', () => {
    // Sin ancla, un recibo del 31 se quedaría en el 28 para siempre.
    expect(sumarMeses('2026-02-28', 1, 31)).toBe('2026-03-31')
    expect(sumarMeses('2026-02-28', 1)).toBe('2026-03-28')
  })
})

describe('proximaFecha', () => {
  it('avanza un periodo desde el cargo actual', () => {
    expect(proximaFecha(rec({ nextDate: '2026-08-31', dayAnchor: 31 }))).toBe('2026-09-30')
    expect(proximaFecha(rec({ nextDate: '2026-01-15', intervalMonths: 12, dayAnchor: 15 }))).toBe(
      '2027-01-15',
    )
  })
})

describe('cargosPendientes', () => {
  it('devuelve el cargo del día y deja esperando el siguiente', () => {
    const { fechas, siguiente, truncado } = cargosPendientes(
      // El ancla manda sobre el día de nextDate: son el mismo día salvo que un
      // mes corto haya recortado el cargo anterior.
      rec({ nextDate: '2026-08-28', dayAnchor: 28 }),
      '2026-08-28',
    )
    expect(fechas).toEqual(['2026-08-28'])
    expect(siguiente).toBe('2026-09-28')
    expect(truncado).toBe(false)
  })

  it('no devuelve nada si el cargo aún no ha llegado', () => {
    const { fechas, siguiente } = cargosPendientes(rec({ nextDate: '2026-09-03' }), '2026-08-28')
    expect(fechas).toEqual([])
    expect(siguiente).toBe('2026-09-03')
  })

  it('recupera todos los cargos atrasados (servidor parado tres meses)', () => {
    const { fechas, siguiente } = cargosPendientes(
      rec({ nextDate: '2026-05-03', dayAnchor: 3 }),
      '2026-08-28',
    )
    expect(fechas).toEqual(['2026-05-03', '2026-06-03', '2026-07-03', '2026-08-03'])
    expect(siguiente).toBe('2026-09-03')
  })

  it('con periodicidad anual, un solo cargo por año', () => {
    const { fechas, siguiente } = cargosPendientes(
      rec({ nextDate: '2024-06-20', intervalMonths: 12, dayAnchor: 20 }),
      '2026-08-28',
    )
    expect(fechas).toEqual(['2024-06-20', '2025-06-20', '2026-06-20'])
    expect(siguiente).toBe('2027-06-20')
  })

  it('frena en MAX_CARGOS y salta al primer cargo futuro', () => {
    const { fechas, siguiente, truncado } = cargosPendientes(
      rec({ nextDate: '2019-01-10', dayAnchor: 10 }),
      '2026-08-28',
    )
    expect(fechas).toHaveLength(MAX_CARGOS)
    expect(fechas[0]).toBe('2019-01-10')
    expect(truncado).toBe(true)
    // El siguiente queda en el futuro: no vuelve a inundar mañana.
    expect(siguiente > '2026-08-28').toBe(true)
  })

  it('sin periodicidad no genera nada (y no se queda colgado)', () => {
    expect(cargosPendientes(rec({ intervalMonths: 0 }), '2026-08-28')).toEqual({
      fechas: [], siguiente: '2026-08-03', truncado: false,
    })
  })
})

describe('equivalenteMensual y resumenRecurrentes', () => {
  it('reparte los no mensuales entre sus meses', () => {
    expect(equivalenteMensual({ amount: 600, intervalMonths: 12 })).toBe(50)
    expect(equivalenteMensual({ amount: 90, intervalMonths: 3 })).toBe(30)
    expect(equivalenteMensual({ amount: 24, intervalMonths: 1 })).toBe(24)
  })

  it('suma gasto e ingreso al mes y deja fuera los pausados', () => {
    expect(
      resumenRecurrentes([
        rec({ uuid: 'a', amount: 720, intervalMonths: 1 }),
        rec({ uuid: 'b', amount: 600, intervalMonths: 12 }),
        rec({ uuid: 'c', amount: 1850, intervalMonths: 1, type: 'INGRESO' }),
        rec({ uuid: 'd', amount: 999, intervalMonths: 1, active: false }),
      ]),
    ).toEqual({ gasto: 770, ingreso: 1850, neto: 1080, activos: 3 })
  })

  it('sin recurrentes, todo a cero', () => {
    expect(resumenRecurrentes([])).toEqual({ gasto: 0, ingreso: 0, neto: 0, activos: 0 })
  })
})

describe('etiquetaPeriodo', () => {
  it('usa el nombre de las periodicidades conocidas y compone las demás', () => {
    expect(etiquetaPeriodo(1)).toBe('Cada mes')
    expect(etiquetaPeriodo(3)).toBe('Cada trimestre')
    expect(etiquetaPeriodo(12)).toBe('Cada año')
    expect(etiquetaPeriodo(7)).toBe('Cada 7 meses')
  })
})

// ─────────── generador del cron ───────────

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    recurringExpense: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    expense: { createMany: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async () => []),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/correo', () => ({
  correoConfigurado: () => false,
  enviarCorreo: vi.fn(),
  tarjetaHtml: () => '',
  botonHtml: () => '',
}))

/** Fila de BD simulada (fechas como Date, importe como número). */
const fila = (p: Record<string, unknown> = {}) => ({
  uuid: 'r1',
  type: 'GASTO',
  concept: 'Alquiler',
  amount: 720,
  intervalMonths: 1,
  nextDate: new Date('2026-08-03T00:00:00Z'),
  dayAnchor: 3,
  active: true,
  lastCreated: null,
  categoryUuid: 'c1',
  ...p,
})

const fechasCreadas = () =>
  (prismaMock.expense.createMany.mock.calls[0][0].data as Array<{ expenseDate: Date }>).map((m) =>
    m.expenseDate.toISOString().slice(0, 10),
  )

describe('generarRecurrentes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockResolvedValue([])
  })

  it('apunta el movimiento del cargo vencido y adelanta la próxima fecha', async () => {
    prismaMock.recurringExpense.findMany.mockResolvedValue([fila()])
    const { generarRecurrentes } = await import('@/lib/gastos')
    expect(await generarRecurrentes('2026-08-28')).toBe(1)

    const movimiento = prismaMock.expense.createMany.mock.calls[0][0].data[0]
    expect(movimiento).toMatchObject({ type: 'GASTO', concept: 'Alquiler', amount: 720, categoryUuid: 'c1' })
    expect(fechasCreadas()).toEqual(['2026-08-03'])

    const patch = prismaMock.recurringExpense.update.mock.calls[0][0].data
    expect(patch.nextDate.toISOString().slice(0, 10)).toBe('2026-09-03')
    expect(patch.lastCreated.toISOString().slice(0, 10)).toBe('2026-08-03')
  })

  it('solo pide los activos que ya han vencido', async () => {
    prismaMock.recurringExpense.findMany.mockResolvedValue([])
    const { generarRecurrentes } = await import('@/lib/gastos')
    expect(await generarRecurrentes('2026-08-28')).toBe(0)

    const where = prismaMock.recurringExpense.findMany.mock.calls[0][0].where
    expect(where.active).toBe(true)
    expect(where.nextDate.lte.toISOString().slice(0, 10)).toBe('2026-08-28')
    expect(prismaMock.expense.createMany).not.toHaveBeenCalled()
  })

  it('recupera varios cargos atrasados de una vez', async () => {
    prismaMock.recurringExpense.findMany.mockResolvedValue([
      fila({ nextDate: new Date('2026-06-03T00:00:00Z') }),
    ])
    const { generarRecurrentes } = await import('@/lib/gastos')
    expect(await generarRecurrentes('2026-08-28')).toBe(3)
    expect(fechasCreadas()).toEqual(['2026-06-03', '2026-07-03', '2026-08-03'])
  })

  it('cuenta los movimientos de todos los recurrentes vencidos', async () => {
    prismaMock.recurringExpense.findMany.mockResolvedValue([
      fila(),
      fila({ uuid: 'r2', concept: 'Netflix', amount: 13, nextDate: new Date('2026-08-12T00:00:00Z'), dayAnchor: 12 }),
    ])
    const { generarRecurrentes } = await import('@/lib/gastos')
    expect(await generarRecurrentes('2026-08-28')).toBe(2)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
  })
})

describe('apuntarRecurrenteYa (el botón "Apuntar ahora")', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockResolvedValue([])
  })

  it('apunta el cargo aunque AÚN NO haya vencido, y adelanta la fecha', async () => {
    // Próximo cargo el 3 de septiembre; hoy es 28 de agosto.
    prismaMock.recurringExpense.findUnique.mockResolvedValue(
      fila({ nextDate: new Date('2026-09-03T00:00:00Z') }),
    )
    const { apuntarRecurrenteYa } = await import('@/lib/gastos')
    expect(await apuntarRecurrenteYa('r1', '2026-08-28')).toEqual({
      creados: 1,
      hasta: '2026-09-03',
    })
    // Se apunta con SU fecha, no con la de hoy: así el cron no lo duplica.
    expect(fechasCreadas()).toEqual(['2026-09-03'])
    const patch = prismaMock.recurringExpense.update.mock.calls[0][0].data
    expect(patch.nextDate.toISOString().slice(0, 10)).toBe('2026-10-03')
  })

  it('si estaba atrasado, recupera todos los cargos pendientes', async () => {
    prismaMock.recurringExpense.findUnique.mockResolvedValue(
      fila({ nextDate: new Date('2026-06-03T00:00:00Z') }),
    )
    const { apuntarRecurrenteYa } = await import('@/lib/gastos')
    expect(await apuntarRecurrenteYa('r1', '2026-08-28')).toEqual({
      creados: 3,
      hasta: '2026-08-28',
    })
    expect(fechasCreadas()).toEqual(['2026-06-03', '2026-07-03', '2026-08-03'])
  })

  it('marca el ORIGEN del movimiento con el recurrente', async () => {
    prismaMock.recurringExpense.findUnique.mockResolvedValue(fila())
    const { apuntarRecurrenteYa } = await import('@/lib/gastos')
    await apuntarRecurrenteYa('r1', '2026-08-28')
    expect(prismaMock.expense.createMany.mock.calls[0][0].data[0].recurringUuid).toBe('r1')
  })

  it('funciona con el recurrente en pausa y no lo reactiva', async () => {
    prismaMock.recurringExpense.findUnique.mockResolvedValue(fila({ active: false }))
    const { apuntarRecurrenteYa } = await import('@/lib/gastos')
    expect((await apuntarRecurrenteYa('r1', '2026-08-28'))?.creados).toBe(1)
    expect(prismaMock.recurringExpense.update.mock.calls[0][0].data.active).toBeUndefined()
  })

  it('con un uuid que no existe devuelve null', async () => {
    prismaMock.recurringExpense.findUnique.mockResolvedValue(null)
    const { apuntarRecurrenteYa } = await import('@/lib/gastos')
    expect(await apuntarRecurrenteYa('fantasma', '2026-08-28')).toBeNull()
    expect(prismaMock.expense.createMany).not.toHaveBeenCalled()
  })
})

describe('movimientosDeRecurrente', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devuelve el total y los últimos movimientos que generó', async () => {
    prismaMock.expense.count.mockResolvedValue(14)
    prismaMock.expense.findMany.mockResolvedValue([
      {
        uuid: 'm1', type: 'GASTO', concept: 'Alquiler', amount: 720,
        expenseDate: new Date('2026-08-03T00:00:00Z'), categoryUuid: 'c1',
      },
    ])
    const { movimientosDeRecurrente } = await import('@/lib/gastos')
    const res = await movimientosDeRecurrente('r1')
    expect(res.total).toBe(14)
    expect(res.movimientos).toEqual([
      {
        uuid: 'm1', type: 'GASTO', concept: 'Alquiler', amount: 720,
        expenseDate: '2026-08-03', categoryUuid: 'c1',
      },
    ])
    // Acotado a ese recurrente y del más reciente al más antiguo.
    expect(prismaMock.expense.findMany.mock.calls[0][0].where).toEqual({ recurringUuid: 'r1' })
    expect(prismaMock.expense.count.mock.calls[0][0].where).toEqual({ recurringUuid: 'r1' })
  })
})
