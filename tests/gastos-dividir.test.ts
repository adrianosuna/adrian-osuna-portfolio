// Guardas de `dividirGasto`: la suma de las partes TIENE que cuadrar con el
// importe original. Es la validación que evita que dividir una compra descuadre
// el mes en silencio, y la comparación va en céntimos porque en decimales
// 0.1 + 0.2 no da 0.3.
import { beforeEach, describe, expect, it, vi } from 'vitest'
// El tope de peticiones vive en memoria y es COMPARTIDO por todo el proceso:
// sin reiniciarlo, un fichero de tests con muchas actions agotaría la ventana
// y los siguientes fallarían por algo que no están probando.
import { reiniciarLimites } from '@/lib/rate-limit'

const { requireAdminMock, prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    expense: {
      findUnique: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  }
  return { requireAdminMock: vi.fn(), prismaMock }
})

vi.mock('@/auth', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/gastos', () => ({
  apuntarRecurrenteYa: vi.fn(),
  listCategorias: vi.fn(),
  movimientosDeRecurrente: vi.fn(),
}))

const ORIGINAL = {
  uuid: 'm-1',
  type: 'GASTO',
  concept: 'Compra',
  amount: 100,
  expenseDate: new Date('2026-09-01T00:00:00Z'),
  categoryUuid: 'c-super',
  recurringUuid: null,
  note: 'con la tarjeta',
}

const cargar = () => import('@/app/app/finance/gastos-actions')

beforeEach(() => {
  reiniciarLimites()
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue({ user: { uuid: 'admin-1', role: 'ADMIN' } })
  prismaMock.expense.findUnique.mockResolvedValue(ORIGINAL)
})

describe('dividirGasto', () => {
  it('divide cuando la suma cuadra, y borra el original en la misma transacción', async () => {
    const { dividirGasto } = await cargar()
    const res = await dividirGasto('m-1', [
      { concept: 'Súper', amount: 70, categoryUuid: 'c-super' },
      { concept: 'Farmacia', amount: 30, categoryUuid: 'c-farmacia' },
    ])
    expect(res.ok).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
    const data = prismaMock.expense.createMany.mock.calls[0][0].data
    expect(data).toHaveLength(2)
    // Tipo, fecha y nota se heredan del original.
    expect(data[0]).toMatchObject({
      type: 'GASTO', concept: 'Súper', amount: 70,
      expenseDate: ORIGINAL.expenseDate, categoryUuid: 'c-super', note: 'con la tarjeta',
    })
    expect(data[1]).toMatchObject({ concept: 'Farmacia', amount: 30, categoryUuid: 'c-farmacia' })
    expect(prismaMock.expense.delete).toHaveBeenCalledWith({ where: { uuid: 'm-1' } })
  })

  it('rechaza si las partes suman de menos o de más', async () => {
    const { dividirGasto } = await cargar()
    const falta = await dividirGasto('m-1', [
      { concept: 'a', amount: 40 },
      { concept: 'b', amount: 30 },
    ])
    expect(falta).toEqual({ ok: false, message: 'Faltan 30.00 € por asignar' })

    const sobra = await dividirGasto('m-1', [
      { concept: 'a', amount: 80 },
      { concept: 'b', amount: 30 },
    ])
    expect(sobra).toEqual({ ok: false, message: 'Las partes suman 10.00 € de más' })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('acepta décimas que solo cuadran en céntimos (0.1 + 0.2 ≠ 0.3 en binario)', async () => {
    prismaMock.expense.findUnique.mockResolvedValue({ ...ORIGINAL, amount: 0.3 })
    const { dividirGasto } = await cargar()
    const res = await dividirGasto('m-1', [
      { concept: 'a', amount: 0.1 },
      { concept: 'b', amount: 0.2 },
    ])
    expect(res.ok).toBe(true)
  })

  it('exige al menos dos partes y no admite más de diez', async () => {
    const { dividirGasto } = await cargar()
    expect(await dividirGasto('m-1', [{ concept: 'a', amount: 100 }])).toEqual({
      ok: false,
      message: 'Indica al menos dos partes',
    })
    const once = Array.from({ length: 11 }, () => ({ concept: 'a', amount: 100 / 11 }))
    expect((await dividirGasto('m-1', once)).message).toBe('Como mucho 10 partes')
  })

  it('rechaza una parte sin concepto o con importe cero', async () => {
    const { dividirGasto } = await cargar()
    expect(
      await dividirGasto('m-1', [
        { concept: '   ', amount: 50 },
        { concept: 'b', amount: 50 },
      ]),
    ).toEqual({ ok: false, message: 'El concepto es obligatorio' })

    expect(
      await dividirGasto('m-1', [
        { concept: 'a', amount: 0 },
        { concept: 'b', amount: 100 },
      ]),
    ).toEqual({ ok: false, message: 'Cada parte necesita un importe mayor que cero' })
  })

  it('si el movimiento no existe, no escribe nada', async () => {
    prismaMock.expense.findUnique.mockResolvedValue(null)
    const { dividirGasto } = await cargar()
    expect(await dividirGasto('fantasma', [
      { concept: 'a', amount: 50 },
      { concept: 'b', amount: 50 },
    ])).toEqual({ ok: false, message: 'Ese movimiento no existe' })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('sin permisos de admin no divide nada', async () => {
    const { AppError } = await import('@/lib/errors')
    requireAdminMock.mockRejectedValue(new AppError('Necesitas ser administrador'))
    const { dividirGasto } = await cargar()
    expect(await dividirGasto('m-1', [
      { concept: 'a', amount: 50 },
      { concept: 'b', amount: 50 },
    ])).toEqual({ ok: false, message: 'Necesitas ser administrador' })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
