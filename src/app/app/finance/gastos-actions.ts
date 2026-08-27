'use server'

// Server actions del control de gastos e ingresos (personal del admin):
// movimientos y categorías. Mismo contrato: { ok, message? } y revalidación.
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/auth'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

type Result = { ok: boolean; message?: string }

const ok: Result = { ok: true }
const fail = (message: string): Result => ({ ok: false, message })
const refresh = () => revalidatePath('/app/finance')

async function guarded(fn: () => Promise<Result>): Promise<Result> {
  try {
    await requireAdmin()
    return await fn()
  } catch (e) {
    if (e instanceof AppError) return fail(e.message)
    console.error('[gastos]', e)
    return fail('Error inesperado')
  }
}

// Fecha 'YYYY-MM-DD' válida → medianoche UTC; si no, null.
const fecha = (v: string | null | undefined) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null

// Concepto e importe comunes al alta y la edición.
type Parsed = { error: string } | { error?: never; concept: string; amount: number }
const limpiar = (datos: { concept?: string; amount?: number | null }): Parsed => {
  const concept = (datos.concept ?? '').trim().slice(0, 255)
  const amount = Number(datos.amount)
  if (!concept) return { error: 'El concepto es obligatorio' }
  if (!Number.isFinite(amount) || amount < 0 || amount >= 1e10) return { error: 'Importe no válido' }
  return { concept, amount }
}

// Tipo del movimiento/categoría: solo ingreso o gasto (whitelist).
const TIPOS = ['INGRESO', 'GASTO'] as const
type Tipo = (typeof TIPOS)[number]
const tipoValido = (v: unknown): v is Tipo =>
  typeof v === 'string' && (TIPOS as readonly string[]).includes(v)

// Color hexadecimal (#rrggbb); si no lo es, se cae al gris de "Otros".
const COLOR_POR_DEFECTO = '#94a3b8'
const color = (v: string | null | undefined) =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : COLOR_POR_DEFECTO

// ─────────── Gastos ───────────

interface DatosGasto {
  type?: string
  concept?: string
  amount?: number | null
  expenseDate?: string | null
  categoryUuid?: string | null
}

export async function createGasto(datos: DatosGasto): Promise<Result> {
  return guarded(async () => {
    const parsed = limpiar(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    const dia = fecha(datos.expenseDate)
    if (!dia) return fail('Indica la fecha del movimiento')
    if (!tipoValido(datos.type)) return fail('Indica si es un ingreso o un gasto')
    await prisma.expense.create({
      data: {
        ...parsed,
        type: datos.type,
        expenseDate: dia,
        categoryUuid: datos.categoryUuid || null,
      },
    })
    refresh()
    return ok
  })
}

export async function updateGasto(uuid: string, datos: DatosGasto): Promise<Result> {
  return guarded(async () => {
    const patch: Record<string, unknown> = {}
    if (datos.concept !== undefined || datos.amount !== undefined) {
      const parsed = limpiar(datos)
      if (parsed.error !== undefined) return fail(parsed.error)
      patch.concept = parsed.concept
      patch.amount = parsed.amount
    }
    if (datos.expenseDate !== undefined) {
      const dia = fecha(datos.expenseDate)
      if (!dia) return fail('Fecha no válida')
      patch.expenseDate = dia
    }
    if (datos.type !== undefined) {
      if (!tipoValido(datos.type)) return fail('Tipo no válido')
      patch.type = datos.type
    }
    if (datos.categoryUuid !== undefined) patch.categoryUuid = datos.categoryUuid || null
    if (!Object.keys(patch).length) return fail('Nada que actualizar')
    await prisma.expense.update({ where: { uuid }, data: patch })
    refresh()
    return ok
  })
}

export async function deleteGasto(uuid: string): Promise<Result> {
  return guarded(async () => {
    await prisma.expense.delete({ where: { uuid } })
    refresh()
    return ok
  })
}

// ─────────── Categorías ───────────

export async function createCategoria(datos: {
  name?: string
  color?: string
  type?: string
}): Promise<Result> {
  return guarded(async () => {
    const name = (datos.name ?? '').trim().slice(0, 100)
    if (!name) return fail('El nombre es obligatorio')
    if (!tipoValido(datos.type)) return fail('Indica si la categoría es de ingreso o de gasto')
    // El nombre solo debe ser único DENTRO de su tipo ("Regalos" puede ser
    // categoría de gasto y de ingreso a la vez).
    if (await prisma.expenseCategory.findFirst({ where: { name, type: datos.type } })) {
      return fail('Ya existe una categoría con ese nombre')
    }
    await prisma.expenseCategory.create({
      data: { name, type: datos.type, color: color(datos.color) },
    })
    refresh()
    return ok
  })
}

export async function updateCategoria(
  uuid: string,
  datos: { name?: string; color?: string },
): Promise<Result> {
  return guarded(async () => {
    const patch: { name?: string; color?: string } = {}
    if (datos.name !== undefined) {
      const name = datos.name.trim().slice(0, 100)
      if (!name) return fail('El nombre es obligatorio')
      const actual = await prisma.expenseCategory.findUnique({ where: { uuid } })
      if (!actual) return fail('Categoría no encontrada')
      const otra = await prisma.expenseCategory.findFirst({ where: { name, type: actual.type } })
      if (otra && otra.uuid !== uuid) return fail('Ya existe una categoría con ese nombre')
      patch.name = name
    }
    if (datos.color !== undefined) patch.color = color(datos.color)
    if (!Object.keys(patch).length) return fail('Nada que actualizar')
    await prisma.expenseCategory.update({ where: { uuid }, data: patch })
    refresh()
    return ok
  })
}

/** Borra una categoría. Sus movimientos NO se borran: quedan sin categoría
 *  (el FK es SET NULL), que es lo que se espera del historial del dinero. */
export async function deleteCategoria(uuid: string): Promise<Result> {
  return guarded(async () => {
    await prisma.expenseCategory.delete({ where: { uuid } })
    refresh()
    return ok
  })
}
