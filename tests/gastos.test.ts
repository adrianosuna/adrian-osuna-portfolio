// Control de gastos e ingresos: validaciones de las server actions (saneado,
// importes, fechas, tipo del movimiento, nombres de categoría duplicados por
// tipo, topes y recurrentes) y la capa de datos del mes y del año (rangos con
// cruce de año, balance, media diaria y los dos desgloses por categoría).
// El cálculo de los topes está en topes.test.ts y el de los recurrentes en
// recurrentes.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest'
// El tope de peticiones vive en memoria y es COMPARTIDO por todo el proceso:
// sin reiniciarlo, un fichero de tests con muchas actions agotaría la ventana
// y los siguientes fallarían por algo que no están probando.
import { reiniciarLimites } from '@/lib/rate-limit'

const { requireAdminMock, prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    expense: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    expenseCategory: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    recurringExpense: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  }
  return { requireAdminMock: vi.fn(), prismaMock }
})

vi.mock('@/auth', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  reiniciarLimites()
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue({ user: { uuid: 'admin-1', role: 'ADMIN' } })
  prismaMock.expenseCategory.findFirst.mockResolvedValue(null)
  // Colores ya usados (el alta elige uno libre) y categoría sin uso (el
  // borrado comprueba antes que no la use nada).
  prismaMock.expenseCategory.findMany.mockResolvedValue([])
  prismaMock.expense.count.mockResolvedValue(0)
  prismaMock.recurringExpense.count.mockResolvedValue(0)
  // `altaMovimiento` comprueba que la categoría existe y que es del tipo del
  // movimiento; por defecto, la que se pida es válida para los dos tipos.
  prismaMock.expenseCategory.findUnique.mockImplementation(async ({ where }: { where: { uuid: string } }) => ({
    uuid: where.uuid,
    type: where.uuid.startsWith('i') ? 'INGRESO' : 'GASTO',
  }))
  // Lo creado se devuelve: el alta lee la fila para responder con su uuid.
  prismaMock.expense.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    uuid: 'g-nuevo',
    ...data,
  }))
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
      // El mensaje viene de `lib/esquemas.ts` y dice qué le pasa al importe.
      ok: false, message: 'El importe no puede ser negativo',
    })
    expect(await createGasto({ ...base, expenseDate: '26/08/2026' })).toEqual({
      ok: false, message: 'La fecha del movimiento no es válida',
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
    // Con cadena vacía no hay nada que comprobar: no se consulta la tabla.
    expect(prismaMock.expenseCategory.findUnique).not.toHaveBeenCalled()
  })

  it('rechaza una categoría del tipo contrario', async () => {
    const { createGasto } = await import('@/app/app/finance/gastos-actions')
    // 'i1' es de INGRESO en el mock; el movimiento es un GASTO.
    const res = await createGasto({ ...base, categoryUuid: 'i1' })
    expect(res).toEqual({ ok: false, message: 'La categoría no es de ese tipo' })
    expect(prismaMock.expense.create).not.toHaveBeenCalled()
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

  it('el color lo pone la aplicación y no repite los que ya hay', async () => {
    const { createCategoria } = await import('@/app/app/finance/gastos-actions')
    prismaMock.expenseCategory.findMany.mockResolvedValue([
      { color: '#10b981' }, { color: '#f59e0b' },
    ])
    await createCategoria({ name: 'Viajes', type: 'GASTO' })
    const data = prismaMock.expenseCategory.create.mock.calls[0][0].data
    expect(data).toMatchObject({ name: 'Viajes', type: 'GASTO', budget: null })
    expect(data.color).toMatch(/^#[0-9a-f]{6}$/)
    expect(['#10b981', '#f59e0b']).not.toContain(data.color)
  })

  it('el tope solo se guarda en las categorías de gasto', async () => {
    const { createCategoria } = await import('@/app/app/finance/gastos-actions')
    await createCategoria({ name: 'Bonus', type: 'INGRESO', budget: 500 })
    expect(prismaMock.expenseCategory.create.mock.calls[0][0].data.budget).toBeNull()
  })

  it('no se puede borrar una categoría que usa algo (hay que fusionarla)', async () => {
    const { deleteCategoria } = await import('@/app/app/finance/gastos-actions')
    prismaMock.expense.count.mockResolvedValue(27)
    prismaMock.recurringExpense.count.mockResolvedValue(1)
    expect(await deleteCategoria('c1')).toEqual({
      ok: false,
      message: 'No se puede borrar: la usan 27 movimientos y 1 recurrente. Fusiónala en otra categoría.',
    })
    expect(prismaMock.expenseCategory.delete).not.toHaveBeenCalled()
  })

  it('una categoría sin uso sí se borra', async () => {
    const { deleteCategoria } = await import('@/app/app/finance/gastos-actions')
    expect(await deleteCategoria('c1')).toEqual({ ok: true })
    expect(prismaMock.expenseCategory.delete).toHaveBeenCalledWith({ where: { uuid: 'c1' } })
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
    { uuid: 'c1', name: 'Supermercado', type: 'GASTO' as const, color: '#10b981', usos: 2, usosRecurrentes: 0, budget: null },
    { uuid: 'c2', name: 'Comer fuera', type: 'GASTO' as const, color: '#f59e0b', usos: 1, usosRecurrentes: 0, budget: null },
    { uuid: 'i1', name: 'Nómina', type: 'INGRESO' as const, color: '#10b981', usos: 1, usosRecurrentes: 0, budget: null },
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
      { uuid: 'c1', name: 'Casa', type: 'GASTO' as const, color: '#10b981', usos: 2, usosRecurrentes: 0, budget: null },
      { uuid: 'i1', name: 'Nómina', type: 'INGRESO' as const, color: '#3b82f6', usos: 1, usosRecurrentes: 0, budget: null },
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

// ─────────── Topes de las categorías ───────────

describe('updateCategoria: tope mensual', () => {
  beforeEach(() => {
    prismaMock.expenseCategory.findUnique.mockResolvedValue({
      uuid: 'c1', name: 'Casa', type: 'GASTO', color: '#10b981', budget: null,
    })
  })

  it('guarda el tope y reinicia la marca de aviso', async () => {
    const { updateCategoria } = await import('@/app/app/finance/gastos-actions')
    expect(await updateCategoria('c1', { budget: 450 })).toEqual({ ok: true })
    expect(prismaMock.expenseCategory.update.mock.calls[0][0].data).toEqual({
      budget: 450,
      notified: null,
    })
  })

  it('un tope de 0 o vacío es "sin tope"', async () => {
    const { updateCategoria } = await import('@/app/app/finance/gastos-actions')
    await updateCategoria('c1', { budget: 0 })
    expect(prismaMock.expenseCategory.update.mock.calls[0][0].data.budget).toBeNull()
    await updateCategoria('c1', { budget: null })
    expect(prismaMock.expenseCategory.update.mock.calls[1][0].data.budget).toBeNull()
  })

  it('rechaza un tope negativo o disparatado', async () => {
    const { updateCategoria } = await import('@/app/app/finance/gastos-actions')
    expect(await updateCategoria('c1', { budget: -10 })).toEqual({
      ok: false, message: 'Tope no válido',
    })
    expect(await updateCategoria('c1', { budget: 1e10 })).toEqual({
      ok: false, message: 'Tope no válido',
    })
    expect(prismaMock.expenseCategory.update).not.toHaveBeenCalled()
  })
})

// ─────────── Recurrentes ───────────

describe('createRecurrente', () => {
  const base = {
    type: 'GASTO',
    concept: 'Alquiler',
    amount: 720,
    intervalMonths: 1,
    nextDate: '2026-09-03',
  }

  it('exige concepto, tipo, periodicidad y fecha', async () => {
    const { createRecurrente } = await import('@/app/app/finance/gastos-actions')
    expect(await createRecurrente({ ...base, concept: ' ' })).toEqual({
      ok: false, message: 'El concepto es obligatorio',
    })
    expect(await createRecurrente({ ...base, type: 'TRANSFERENCIA' })).toEqual({
      ok: false, message: 'Indica si es un ingreso o un gasto',
    })
    expect(await createRecurrente({ ...base, intervalMonths: 0 })).toEqual({
      ok: false, message: 'Periodicidad no válida',
    })
    // 121 pasa del tope (120 = 10 años); 36 (cada 3 años) ya es válido.
    expect(await createRecurrente({ ...base, intervalMonths: 121 })).toEqual({
      ok: false, message: 'Periodicidad no válida',
    })
    expect(await createRecurrente({ ...base, nextDate: '03/09/2026' })).toEqual({
      ok: false, message: 'Fecha del próximo cargo no válida',
    })
    expect(prismaMock.recurringExpense.create).not.toHaveBeenCalled()
  })

  it('rechaza una fecha con más de un año de retraso (sería un histórico falso)', async () => {
    const { createRecurrente } = await import('@/app/app/finance/gastos-actions')
    expect(await createRecurrente({ ...base, nextDate: '2019-01-10' })).toEqual({
      ok: false, message: 'Fecha del próximo cargo no válida',
    })
  })

  it('guarda el ancla con el día elegido', async () => {
    const { createRecurrente } = await import('@/app/app/finance/gastos-actions')
    expect(await createRecurrente({ ...base, nextDate: '2026-09-30', categoryUuid: 'c1' })).toEqual({
      ok: true,
    })
    const data = prismaMock.recurringExpense.create.mock.calls[0][0].data
    expect(data).toMatchObject({ type: 'GASTO', concept: 'Alquiler', amount: 720, dayAnchor: 30 })
    expect(data.nextDate.toISOString()).toBe('2026-09-30T00:00:00.000Z')
  })

  it('acepta una periodicidad personalizada dentro del tope (cada 3 años)', async () => {
    const { createRecurrente } = await import('@/app/app/finance/gastos-actions')
    expect(await createRecurrente({ ...base, intervalMonths: 36 })).toEqual({ ok: true })
    expect(prismaMock.recurringExpense.create.mock.calls[0][0].data.intervalMonths).toBe(36)
  })
})

describe('updateRecurrente', () => {
  it('pausa sin tocar el resto', async () => {
    const { updateRecurrente } = await import('@/app/app/finance/gastos-actions')
    expect(await updateRecurrente('r1', { active: false })).toEqual({ ok: true })
    expect(prismaMock.recurringExpense.update.mock.calls[0][0].data).toEqual({ active: false })
  })

  it('al cambiar la fecha recalcula el ancla', async () => {
    const { updateRecurrente } = await import('@/app/app/finance/gastos-actions')
    await updateRecurrente('r1', { nextDate: '2026-10-15' })
    expect(prismaMock.recurringExpense.update.mock.calls[0][0].data.dayAnchor).toBe(15)
  })

  it('sin nada que cambiar, no toca la BD', async () => {
    const { updateRecurrente } = await import('@/app/app/finance/gastos-actions')
    expect(await updateRecurrente('r1', {})).toEqual({ ok: false, message: 'Nada que actualizar' })
    expect(prismaMock.recurringExpense.update).not.toHaveBeenCalled()
  })
})

// ─────────── Fusionar y ordenar categorías ───────────

describe('fusionarCategorias', () => {
  const gasto = (uuid: string, name: string) => ({ uuid, name, type: 'GASTO' })

  beforeEach(() => {
    prismaMock.$transaction.mockResolvedValue([{ count: 27 }, { count: 2 }, {}])
  })

  it('mueve movimientos y recurrentes al destino y borra la de origen', async () => {
    prismaMock.expenseCategory.findUnique
      .mockResolvedValueOnce(gasto('c1', 'Comer fuera'))
      .mockResolvedValueOnce(gasto('c2', 'Restaurantes'))
    const { fusionarCategorias } = await import('@/app/app/finance/gastos-actions')

    expect(await fusionarCategorias('c1', 'c2')).toEqual({
      ok: true,
      message: 'Comer fuera → Restaurantes: 27 movimientos y 2 recurrentes',
    })
    // Las tres operaciones van en la MISMA transacción: mover, mover y borrar.
    expect(prismaMock.$transaction.mock.calls[0][0]).toHaveLength(3)
    expect(prismaMock.expense.updateMany).toHaveBeenCalledWith({
      where: { categoryUuid: 'c1' },
      data: { categoryUuid: 'c2' },
    })
    expect(prismaMock.recurringExpense.updateMany).toHaveBeenCalledWith({
      where: { categoryUuid: 'c1' },
      data: { categoryUuid: 'c2' },
    })
    expect(prismaMock.expenseCategory.delete).toHaveBeenCalledWith({ where: { uuid: 'c1' } })
  })

  it('no deja mezclar un gasto con un ingreso', async () => {
    prismaMock.expenseCategory.findUnique
      .mockResolvedValueOnce(gasto('c1', 'Comer fuera'))
      .mockResolvedValueOnce({ uuid: 'i1', name: 'Nómina', type: 'INGRESO' })
    const { fusionarCategorias } = await import('@/app/app/finance/gastos-actions')
    expect(await fusionarCategorias('c1', 'i1')).toEqual({
      ok: false, message: 'Las dos categorías deben ser del mismo tipo',
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('rechaza fusionar una categoría consigo misma o con una que no existe', async () => {
    const { fusionarCategorias } = await import('@/app/app/finance/gastos-actions')
    expect(await fusionarCategorias('c1', 'c1')).toEqual({
      ok: false, message: 'Elige una categoría distinta',
    })
    prismaMock.expenseCategory.findUnique.mockResolvedValue(null)
    expect(await fusionarCategorias('c1', 'fantasma')).toEqual({
      ok: false, message: 'Categoría no encontrada',
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('sin recurrentes, el mensaje solo habla de movimientos', async () => {
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, { count: 0 }, {}])
    prismaMock.expenseCategory.findUnique
      .mockResolvedValueOnce(gasto('c1', 'Otros'))
      .mockResolvedValueOnce(gasto('c2', 'Imprevistos'))
    const { fusionarCategorias } = await import('@/app/app/finance/gastos-actions')
    expect(await fusionarCategorias('c1', 'c2')).toEqual({
      ok: true, message: 'Otros → Imprevistos: 1 movimiento',
    })
  })
})
