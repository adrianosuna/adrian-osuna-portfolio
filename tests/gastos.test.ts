// Control de gastos e ingresos: validaciones de las server actions (saneado,
// importes, fechas, tipo del movimiento, nombres de categoría duplicados por
// tipo) y la capa de datos del mes y del año (rangos con cruce de año,
// balance, media diaria y los dos desgloses por categoría).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdminMock, prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    expense: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
    expenseCategory: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  }
  return { requireAdminMock: vi.fn(), prismaMock }
})

vi.mock('@/auth', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue({ user: { uuid: 'admin-1', role: 'ADMIN' } })
  prismaMock.expenseCategory.findFirst.mockResolvedValue(null)
})

// ─────────── Movimientos ───────────

describe('createGasto', () => {
  const base = { concept: 'Cena', amount: 10, expenseDate: '2026-08-26', type: 'GASTO' }

  it('exige concepto, importe válido, fecha y tipo', async () => {
    const { createGasto } = await import('@/app/app/finance/gastos-actions')
    expect(await createGasto({ ...base, concept: '  ' })).toEqual({
      ok: false, message: 'El concepto es obligatorio',
    })
    expect(await createGasto({ ...base, amount: -3 })).toEqual({
      ok: false, message: 'Importe no válido',
    })
    expect(await createGasto({ ...base, expenseDate: '26/08/2026' })).toEqual({
      ok: false, message: 'Indica la fecha del movimiento',
    })
    expect(await createGasto({ ...base, type: 'TRANSFERENCIA' })).toEqual({
      ok: false, message: 'Indica si es un ingreso o un gasto',
    })
    expect(prismaMock.expense.create).not.toHaveBeenCalled()
  })

  it('crea el movimiento con su tipo, concepto recortado y fecha a medianoche UTC', async () => {
    const { createGasto } = await import('@/app/app/finance/gastos-actions')
    expect(
      await createGasto({
        type: 'INGRESO',
        concept: '  Nómina de agosto ',
        amount: 1800,
        expenseDate: '2026-08-26',
        categoryUuid: 'i1',
      }),
    ).toEqual({ ok: true })
    const data = prismaMock.expense.create.mock.calls[0][0].data
    expect(data.type).toBe('INGRESO')
    expect(data.concept).toBe('Nómina de agosto')
    expect(data.amount).toBe(1800)
    expect(data.categoryUuid).toBe('i1')
    expect((data.expenseDate as Date).toISOString()).toBe('2026-08-26T00:00:00.000Z')
  })

  it('sin categoría se guarda como null (no como cadena vacía)', async () => {
    const { createGasto } = await import('@/app/app/finance/gastos-actions')
    await createGasto({ ...base, categoryUuid: '' })
    expect(prismaMock.expense.create.mock.calls[0][0].data.categoryUuid).toBeNull()
  })
})

describe('updateGasto', () => {
  it('sin cambios no toca la BD', async () => {
    const { updateGasto } = await import('@/app/app/finance/gastos-actions')
    expect(await updateGasto('g1', {})).toEqual({ ok: false, message: 'Nada que actualizar' })
  })

  it('solo la categoría: parche mínimo', async () => {
    const { updateGasto } = await import('@/app/app/finance/gastos-actions')
    expect(await updateGasto('g1', { categoryUuid: 'c2' })).toEqual({ ok: true })
    expect(prismaMock.expense.update).toHaveBeenCalledWith({
      where: { uuid: 'g1' },
      data: { categoryUuid: 'c2' },
    })
  })

  it('un tipo inventado se rechaza', async () => {
    const { updateGasto } = await import('@/app/app/finance/gastos-actions')
    expect(await updateGasto('g1', { type: 'AHORRO' })).toEqual({ ok: false, message: 'Tipo no válido' })
    expect(prismaMock.expense.update).not.toHaveBeenCalled()
  })
})

// ─────────── Categorías ───────────

describe('categorías', () => {
  it('exige nombre y tipo, y el nombre no se repite DENTRO del tipo', async () => {
    const { createCategoria } = await import('@/app/app/finance/gastos-actions')
    expect(await createCategoria({ name: '   ', type: 'GASTO' })).toEqual({
      ok: false, message: 'El nombre es obligatorio',
    })
    expect(await createCategoria({ name: 'Casa' })).toEqual({
      ok: false, message: 'Indica si la categoría es de ingreso o de gasto',
    })
    prismaMock.expenseCategory.findFirst.mockResolvedValue({ uuid: 'otra' })
    expect(await createCategoria({ name: 'Casa', type: 'GASTO' })).toEqual({
      ok: false, message: 'Ya existe una categoría con ese nombre',
    })
    // La comprobación de duplicado se acota al tipo.
    expect(prismaMock.expenseCategory.findFirst).toHaveBeenLastCalledWith({
      where: { name: 'Casa', type: 'GASTO' },
    })
    expect(prismaMock.expenseCategory.create).not.toHaveBeenCalled()
  })

  it('un color inventado cae al gris por defecto', async () => {
    const { createCategoria } = await import('@/app/app/finance/gastos-actions')
    await createCategoria({ name: 'Viajes', type: 'GASTO', color: 'rojo chillón' })
    expect(prismaMock.expenseCategory.create).toHaveBeenCalledWith({
      data: { name: 'Viajes', type: 'GASTO', color: '#94a3b8' },
    })
  })

  it('renombrar a un nombre que ya usa OTRA del mismo tipo se rechaza (el propio vale)', async () => {
    const { updateCategoria } = await import('@/app/app/finance/gastos-actions')
    prismaMock.expenseCategory.findUnique.mockResolvedValue({ uuid: 'c1', type: 'GASTO' })
    prismaMock.expenseCategory.findFirst.mockResolvedValue({ uuid: 'otra' })
    expect(await updateCategoria('c1', { name: 'Casa' })).toEqual({
      ok: false, message: 'Ya existe una categoría con ese nombre',
    })
    prismaMock.expenseCategory.findFirst.mockResolvedValue({ uuid: 'c1' })
    expect(await updateCategoria('c1', { name: 'Casa' })).toEqual({ ok: true })
  })
})

// ─────────── Capa de datos del mes y del año ───────────

describe('getMesMovimientos', () => {
  const categorias = [
    { uuid: 'c1', name: 'Supermercado', type: 'GASTO' as const, color: '#10b981', usos: 2 },
    { uuid: 'c2', name: 'Comer fuera', type: 'GASTO' as const, color: '#f59e0b', usos: 1 },
    { uuid: 'i1', name: 'Nómina', type: 'INGRESO' as const, color: '#10b981', usos: 1 },
  ]

  it('pide el mes por rango [día 1, día 1 del siguiente) y cruza bien el año', async () => {
    const { getMesMovimientos } = await import('@/lib/gastos')
    prismaMock.expense.findMany.mockResolvedValue([])
    prismaMock.expense.groupBy.mockResolvedValue([])

    await getMesMovimientos('2026-12', categorias)
    const rango = prismaMock.expense.findMany.mock.calls[0][0].where.expenseDate
    expect((rango.gte as Date).toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect((rango.lt as Date).toISOString()).toBe('2027-01-01T00:00:00.000Z')

    // El mes anterior de enero es diciembre del año pasado.
    await getMesMovimientos('2026-01', categorias)
    const previo = prismaMock.expense.groupBy.mock.calls[1][0].where.expenseDate
    expect((previo.gte as Date).toISOString()).toBe('2025-12-01T00:00:00.000Z')
    expect((previo.lt as Date).toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('separa ingresos y gastos, calcula el balance y la media diaria', async () => {
    const { getMesMovimientos } = await import('@/lib/gastos')
    prismaMock.expense.findMany.mockResolvedValue([
      { uuid: 'm1', type: 'INGRESO', concept: 'Nómina', amount: 1800, expenseDate: new Date('2026-08-01T00:00:00Z'), categoryUuid: 'i1' },
      { uuid: 'm2', type: 'GASTO', concept: 'Compra', amount: 120, expenseDate: new Date('2026-08-04T00:00:00Z'), categoryUuid: 'c1' },
      { uuid: 'm3', type: 'GASTO', concept: 'Cena', amount: 34, expenseDate: new Date('2026-08-10T00:00:00Z'), categoryUuid: 'c2' },
      { uuid: 'm4', type: 'GASTO', concept: 'Suelto', amount: 26, expenseDate: new Date('2026-08-20T00:00:00Z'), categoryUuid: null },
    ])
    prismaMock.expense.groupBy.mockResolvedValue([
      { type: 'GASTO', _sum: { amount: 200 } },
      { type: 'INGRESO', _sum: { amount: 1700 } },
    ])

    const datos = await getMesMovimientos('2026-08', categorias)
    expect(datos.ingresos).toBe(1800)
    expect(datos.gastos).toBe(180)
    expect(datos.balance).toBe(1620)
    // Agosto tiene 31 días: 180 / 31.
    expect(datos.gastoMedioDia).toBeCloseTo(180 / 31, 6)
    expect(datos.gastosPrevios).toBe(200)
    expect(datos.ingresosPrevios).toBe(1700)
  })

  it('cada desglose solo mira su tipo, ordenado de mayor a menor', async () => {
    const { getMesMovimientos } = await import('@/lib/gastos')
    prismaMock.expense.findMany.mockResolvedValue([
      { uuid: 'm1', type: 'INGRESO', concept: 'Nómina', amount: 1800, expenseDate: new Date('2026-08-01T00:00:00Z'), categoryUuid: 'i1' },
      { uuid: 'm2', type: 'GASTO', concept: 'Compra', amount: 120, expenseDate: new Date('2026-08-04T00:00:00Z'), categoryUuid: 'c1' },
      { uuid: 'm3', type: 'GASTO', concept: 'Cena', amount: 34, expenseDate: new Date('2026-08-10T00:00:00Z'), categoryUuid: 'c2' },
      { uuid: 'm4', type: 'GASTO', concept: 'Suelto', amount: 26, expenseDate: new Date('2026-08-20T00:00:00Z'), categoryUuid: null },
    ])
    prismaMock.expense.groupBy.mockResolvedValue([])

    const datos = await getMesMovimientos('2026-08', categorias)
    expect(datos.porCategoriaGasto).toEqual([
      { uuid: 'c1', name: 'Supermercado', color: '#10b981', total: 120 },
      { uuid: 'c2', name: 'Comer fuera', color: '#f59e0b', total: 34 },
      { uuid: null, name: 'Sin categoría', color: '#94a3b8', total: 26 },
    ])
    expect(datos.porCategoriaIngreso).toEqual([
      { uuid: 'i1', name: 'Nómina', color: '#10b981', total: 1800 },
    ])
  })
})

describe('getAnioMovimientos', () => {
  it('reparte por mes, suma el año y la media solo cuenta meses con datos', async () => {
    const { getAnioMovimientos } = await import('@/lib/gastos')
    prismaMock.expense.findMany.mockResolvedValue([
      { type: 'INGRESO', amount: 1800, expenseDate: new Date('2026-01-10T00:00:00Z'), categoryUuid: 'i1' },
      { type: 'GASTO', amount: 300, expenseDate: new Date('2026-01-15T00:00:00Z'), categoryUuid: 'c1' },
      { type: 'GASTO', amount: 500, expenseDate: new Date('2026-03-02T00:00:00Z'), categoryUuid: 'c1' },
    ])

    const anio = await getAnioMovimientos(2026, [
      { uuid: 'c1', name: 'Casa', type: 'GASTO' as const, color: '#10b981', usos: 2 },
      { uuid: 'i1', name: 'Nómina', type: 'INGRESO' as const, color: '#3b82f6', usos: 1 },
    ])

    expect(anio.meses).toHaveLength(12)
    expect(anio.meses[0]).toEqual({ mes: 1, ingresos: 1800, gastos: 300 })
    expect(anio.meses[1]).toEqual({ mes: 2, ingresos: 0, gastos: 0 })
    expect(anio.meses[2]).toEqual({ mes: 3, ingresos: 0, gastos: 500 })
    expect(anio.ingresos).toBe(1800)
    expect(anio.gastos).toBe(800)
    expect(anio.balance).toBe(1000)
    // Solo enero y marzo tienen movimientos: 800 / 2.
    expect(anio.gastoMedioMes).toBe(400)
    expect(anio.porCategoriaGasto).toEqual([{ uuid: 'c1', name: 'Casa', color: '#10b981', total: 800 }])
  })

  it('pide el año completo por rango', async () => {
    const { getAnioMovimientos } = await import('@/lib/gastos')
    prismaMock.expense.findMany.mockResolvedValue([])
    await getAnioMovimientos(2026, [])
    const rango = prismaMock.expense.findMany.mock.calls[0][0].where.expenseDate
    expect((rango.gte as Date).toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect((rango.lt as Date).toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})
