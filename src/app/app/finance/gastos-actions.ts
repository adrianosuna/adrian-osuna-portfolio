'use server'

// Server actions del control de gastos e ingresos (personal del admin):
// movimientos, recurrentes y categorías (con sus topes). Mismo contrato:
// { ok, message? } y revalidación.
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/auth'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { hoyMadrid } from '@/lib/mantenimiento'
import { colorLibre } from '@/lib/colores'
import { apuntarRecurrenteYa, movimientosDeRecurrente } from '@/lib/gastos'

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

/**
 * Tope mensual de una categoría: número positivo, o null para "sin tope".
 * Vaciar el campo y poner un 0 son la misma intención (quitar el tope), así
 * que las dos guardan null. Devuelve `false` si el valor no vale.
 */
const topeValido = (v: number | null): number | null | false => {
  if (v === null) return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n >= 1e10) return false
  return n === 0 ? null : n
}

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

// ─────────── Recurrentes ───────────

interface DatosRecurrente {
  type?: string
  concept?: string
  amount?: number | null
  intervalMonths?: number | null
  nextDate?: string | null
  categoryUuid?: string | null
  active?: boolean
}

/** Periodicidad en meses: entre 1 y 24 (más allá no es una recurrencia útil). */
const periodoValido = (v: number | null | undefined): number | false => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 24 ? n : false
}

/**
 * Fecha del próximo cargo. Se acepta con hasta un año de retraso —el cron
 * recupera lo pendiente— pero no más: una fecha de 2019 solo puede ser un
 * despiste, y generaría un histórico falso.
 */
const fechaCargo = (v: string | null | undefined, hoyIso: string): Date | false => {
  const dia = fecha(v)
  if (!dia) return false
  const [y, m, d] = hoyIso.split('-').map(Number)
  const minimo = new Date(Date.UTC(y - 1, m - 1, d))
  const maximo = new Date(Date.UTC(y + 10, m - 1, d))
  return dia >= minimo && dia <= maximo ? dia : false
}

export async function createRecurrente(datos: DatosRecurrente): Promise<Result> {
  return guarded(async () => {
    const parsed = limpiar(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    if (!tipoValido(datos.type)) return fail('Indica si es un ingreso o un gasto')
    const interval = periodoValido(datos.intervalMonths)
    if (interval === false) return fail('Periodicidad no válida')
    const dia = fechaCargo(datos.nextDate, hoyMadrid())
    if (dia === false) return fail('Fecha del próximo cargo no válida')

    await prisma.recurringExpense.create({
      data: {
        ...parsed,
        type: datos.type,
        intervalMonths: interval,
        nextDate: dia,
        // El ancla es el día elegido: lo conserva aunque un mes corto lo recorte.
        dayAnchor: dia.getUTCDate(),
        categoryUuid: datos.categoryUuid || null,
      },
    })
    refresh()
    return ok
  })
}

export async function updateRecurrente(uuid: string, datos: DatosRecurrente): Promise<Result> {
  return guarded(async () => {
    const patch: Record<string, unknown> = {}
    if (datos.concept !== undefined || datos.amount !== undefined) {
      const parsed = limpiar(datos)
      if (parsed.error !== undefined) return fail(parsed.error)
      patch.concept = parsed.concept
      patch.amount = parsed.amount
    }
    if (datos.type !== undefined) {
      if (!tipoValido(datos.type)) return fail('Tipo no válido')
      patch.type = datos.type
    }
    if (datos.intervalMonths !== undefined) {
      const interval = periodoValido(datos.intervalMonths)
      if (interval === false) return fail('Periodicidad no válida')
      patch.intervalMonths = interval
    }
    if (datos.nextDate !== undefined) {
      const dia = fechaCargo(datos.nextDate, hoyMadrid())
      if (dia === false) return fail('Fecha del próximo cargo no válida')
      patch.nextDate = dia
      patch.dayAnchor = dia.getUTCDate()
    }
    if (datos.categoryUuid !== undefined) patch.categoryUuid = datos.categoryUuid || null
    if (datos.active !== undefined) patch.active = Boolean(datos.active)
    if (!Object.keys(patch).length) return fail('Nada que actualizar')
    await prisma.recurringExpense.update({ where: { uuid }, data: patch })
    refresh()
    return ok
  })
}

/**
 * Apunta ya el cargo de un recurrente, sin esperar a la pasada del cron.
 *
 * Hace lo mismo que haría el cron (mismo movimiento, misma fecha, y adelanta
 * `next_date`), así que cuando llegue el día no se duplica.
 */
export async function apuntarRecurrenteAhora(uuid: string): Promise<Result> {
  return guarded(async () => {
    const res = await apuntarRecurrenteYa(uuid)
    if (res === null) return fail('Ese recurrente no existe')
    if (res.creados === 0) return fail('No había ningún cargo que apuntar')
    refresh()
    return {
      ok: true,
      message:
        res.creados === 1
          ? 'Cargo apuntado'
          : `${res.creados} cargos apuntados (estaba atrasado)`,
    }
  })
}

/** Movimientos que ha generado un recurrente (para el detalle de su fila). */
export async function leerMovimientosDeRecurrente(uuid: string) {
  try {
    await requireAdmin()
    return await movimientosDeRecurrente(uuid)
  } catch {
    // Sin sesión o sin permisos: el detalle simplemente no se pinta.
    return null
  }
}

/** Borra el recurrente. Los movimientos que ya generó NO se tocan: son gasto
 *  real y viven en el histórico como cualquier otro (pierden el origen). */
export async function deleteRecurrente(uuid: string): Promise<Result> {
  return guarded(async () => {
    await prisma.recurringExpense.delete({ where: { uuid } })
    refresh()
    return ok
  })
}

// ─────────── Categorías ───────────

export async function createCategoria(datos: {
  name?: string
  color?: string
  type?: string
  budget?: number | null
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
    // El tope solo tiene sentido en las categorías de gasto: en una de ingreso
    // se ignora en vez de fallar (el formulario ya no lo ofrece).
    const tope = topeValido(datos.budget ?? null)
    if (tope === false) return fail('Tope no válido')
    // El color lo pone la aplicación, en el hueco más grande del círculo
    // cromático: elegirlo a mano no aportaba nada y con ocho colores fijos
    // había repetidos a partir de la novena categoría.
    const usados = await prisma.expenseCategory.findMany({ select: { color: true } })
    await prisma.expenseCategory.create({
      data: {
        name,
        type: datos.type,
        color: colorLibre(usados.map((c) => c.color)),
        budget: datos.type === 'GASTO' ? tope : null,
      },
    })
    refresh()
    return ok
  })
}

export async function updateCategoria(
  uuid: string,
  datos: { name?: string; budget?: number | null },
): Promise<Result> {
  return guarded(async () => {
    const patch: { name?: string; budget?: number | null; notified?: null } = {}
    if (datos.name !== undefined) {
      const name = datos.name.trim().slice(0, 100)
      if (!name) return fail('El nombre es obligatorio')
      const actual = await prisma.expenseCategory.findUnique({ where: { uuid } })
      if (!actual) return fail('Categoría no encontrada')
      const otra = await prisma.expenseCategory.findFirst({ where: { name, type: actual.type } })
      if (otra && otra.uuid !== uuid) return fail('Ya existe una categoría con ese nombre')
      patch.name = name
    }
    if (datos.budget !== undefined) {
      const tope = topeValido(datos.budget)
      if (tope === false) return fail('Tope no válido')
      patch.budget = tope
      // Cambiar el tope reinicia la marca de aviso: con el límite nuevo, el
      // estado se vuelve a evaluar desde cero en la siguiente pasada del cron.
      patch.notified = null
    }
    if (!Object.keys(patch).length) return fail('Nada que actualizar')
    await prisma.expenseCategory.update({ where: { uuid }, data: patch })
    refresh()
    return ok
  })
}

/**
 * Fusiona una categoría en otra del MISMO tipo: sus movimientos y sus
 * recurrentes pasan a la de destino y la de origen desaparece.
 *
 * Es la salida limpia a los nombres parecidos que se acumulan con el tiempo
 * ("Comer fuera" y "Restaurantes"), donde hasta ahora solo quedaba borrar una
 * y perder la categoría de su historial.
 */
export async function fusionarCategorias(origenUuid: string, destinoUuid: string): Promise<Result> {
  return guarded(async () => {
    if (origenUuid === destinoUuid) return fail('Elige una categoría distinta')
    const [origen, destino] = await Promise.all([
      prisma.expenseCategory.findUnique({ where: { uuid: origenUuid } }),
      prisma.expenseCategory.findUnique({ where: { uuid: destinoUuid } }),
    ])
    if (!origen || !destino) return fail('Categoría no encontrada')
    // Mezclar un gasto con un ingreso no significa nada: son dos listas.
    if (origen.type !== destino.type) return fail('Las dos categorías deben ser del mismo tipo')

    const [movimientos, recurrentes] = await prisma.$transaction([
      prisma.expense.updateMany({
        where: { categoryUuid: origenUuid },
        data: { categoryUuid: destinoUuid },
      }),
      prisma.recurringExpense.updateMany({
        where: { categoryUuid: origenUuid },
        data: { categoryUuid: destinoUuid },
      }),
      prisma.expenseCategory.delete({ where: { uuid: origenUuid } }),
    ])

    refresh()
    const partes = [
      `${movimientos.count} ${movimientos.count === 1 ? 'movimiento' : 'movimientos'}`,
      recurrentes.count > 0
        ? `${recurrentes.count} ${recurrentes.count === 1 ? 'recurrente' : 'recurrentes'}`
        : '',
    ].filter(Boolean)
    return { ok: true, message: `${origen.name} → ${destino.name}: ${partes.join(' y ')}` }
  })
}

/**
 * Borra una categoría, PERO solo si no la usa nada.
 *
 * El FK es SET NULL, así que técnicamente se podría borrar y dejar los
 * movimientos "sin categoría" — y ahí se pierde en silencio la clasificación
 * de todo su historial, que es justo lo que el módulo sirve para tener. Si
 * tiene movimientos o recurrentes, el camino es **fusionarla** en otra.
 */
export async function deleteCategoria(uuid: string): Promise<Result> {
  return guarded(async () => {
    const [movimientos, recurrentes] = await Promise.all([
      prisma.expense.count({ where: { categoryUuid: uuid } }),
      prisma.recurringExpense.count({ where: { categoryUuid: uuid } }),
    ])
    if (movimientos > 0 || recurrentes > 0) {
      const partes = [
        movimientos > 0 ? `${movimientos} ${movimientos === 1 ? 'movimiento' : 'movimientos'}` : '',
        recurrentes > 0 ? `${recurrentes} ${recurrentes === 1 ? 'recurrente' : 'recurrentes'}` : '',
      ].filter(Boolean)
      return fail(`No se puede borrar: la usan ${partes.join(' y ')}. Fusiónala en otra categoría.`)
    }
    await prisma.expenseCategory.delete({ where: { uuid } })
    refresh()
    return ok
  })
}
