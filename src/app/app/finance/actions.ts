'use server'

// Server actions del módulo de finanzas (sistema de ahorro anual). Las
// finanzas son personales del administrador: todas exigen rol ADMIN (un
// usuario invitado no debe poder verlas ni tocarlas). Devuelven { ok, message? }
// como las respuestas del backend original y revalidan la página al terminar.
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/auth'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

type Result = { ok: boolean; message?: string }

const ok: Result = { ok: true }
const fail = (message: string): Result => ({ ok: false, message })
const refresh = () => revalidatePath('/app/finance')

// Ejecuta una acción exigiendo rol admin. Solo los mensajes de AppError son
// aptos para el cliente; el resto (Prisma...) se registra y no se filtra.
async function guarded(fn: () => Promise<Result>): Promise<Result> {
  try {
    await requireAdmin()
    return await fn()
  } catch (e) {
    if (e instanceof AppError) return fail(e.message)
    console.error('[finanzas]', e)
    return fail('Error inesperado')
  }
}

const validYear = (year: number) => Number.isInteger(year) && year >= 2000 && year <= 2100

// ─────────── Años ───────────

export async function createYear(datos: {
  year: number
  goal?: number | null
}): Promise<Result> {
  return guarded(async () => {
    const year = Number(datos.year)
    if (!validYear(year)) return fail('Indica un año válido')
    if (await prisma.savingYear.findUnique({ where: { year } })) return fail('Ese año ya existe')

    const goal = Number(datos.goal)
    await prisma.savingYear.create({
      data: {
        year,
        goal: Number.isFinite(goal) && goal > 0 ? goal : null,
      },
    })
    refresh()
    return ok
  })
}

export async function updateYear(
  uuid: string,
  datos: { year?: number; goal?: number | null },
): Promise<Result> {
  return guarded(async () => {
    const patch: { year?: number; goal?: number | null } = {}
    if (datos.year !== undefined) {
      const year = Number(datos.year)
      if (!validYear(year)) return fail('Indica un año válido')
      const existing = await prisma.savingYear.findUnique({ where: { year } })
      if (existing && existing.uuid !== uuid) return fail('Ese año ya existe')
      patch.year = year
    }
    if (datos.goal !== undefined) {
      const goal = Number(datos.goal)
      patch.goal = Number.isFinite(goal) && goal > 0 ? goal : null
    }
    if (!Object.keys(patch).length) return fail('Nada que actualizar')
    await prisma.savingYear.update({ where: { uuid }, data: patch })
    refresh()
    return ok
  })
}

export async function deleteYear(uuid: string): Promise<Result> {
  return guarded(async () => {
    // El borrado en cascada de la BD limpia meses, extras y gastos de viaje.
    await prisma.savingYear.delete({ where: { uuid } })
    refresh()
    return ok
  })
}

// ─────────── Control mensual (guardado en bloque, upsert por mes) ───────────

export async function saveMonths(
  yearUuid: string,
  months: Array<{ month: number; income: number | null; savingGeneral: number | null; savingTravel: number | null }>,
): Promise<Result> {
  return guarded(async () => {
    const yearRecord = await prisma.savingYear.findUnique({ where: { uuid: yearUuid } })
    if (!yearRecord) return fail('Ese año no existe')
    if (!Array.isArray(months) || !months.length) return fail('Nada que guardar')

    // Solo números finitos y de magnitud razonable (Decimal(12,2) en BD);
    // NaN/Infinity o cifras absurdas de un cliente manipulado quedan en null.
    const clean = (v: number | null | undefined) => {
      if (v === null || v === undefined) return null
      const n = Number(v)
      return Number.isFinite(n) && Math.abs(n) < 1e10 ? n : null
    }
    const rows = months.filter((m) => Number.isInteger(m.month) && m.month >= 1 && m.month <= 12)

    await prisma.$transaction(
      rows.map((m) =>
        prisma.savingMonth.upsert({
          where: { yearUuid_month: { yearUuid, month: m.month } },
          create: {
            yearUuid,
            month: m.month,
            income: clean(m.income),
            savingGeneral: clean(m.savingGeneral),
            savingTravel: clean(m.savingTravel),
          },
          update: {
            income: clean(m.income),
            savingGeneral: clean(m.savingGeneral),
            savingTravel: clean(m.savingTravel),
          },
        }),
      ),
    )
    refresh()
    return ok
  })
}

// ─────────── Conceptos: ingresos extra y gastos de viaje ───────────

// Valida el par concepto/importe común a extras y gastos de viaje.
type ConceptParse = { error: string } | { error?: never; concept: string; amount: number }
const cleanConcept = (datos: { concept?: string; amount?: number | null }): ConceptParse => {
  const concept = (datos.concept || '').trim()
  const amount = Number(datos.amount)
  if (!concept) return { error: 'El concepto es obligatorio' }
  if (!Number.isFinite(amount) || amount < 0) return { error: 'Importe no válido' }
  return { concept, amount }
}

export async function addExtra(yearUuid: string, datos: { concept: string; amount: number }): Promise<Result> {
  return guarded(async () => {
    const parsed = cleanConcept(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    await prisma.savingExtra.create({ data: { yearUuid, ...parsed } })
    refresh()
    return ok
  })
}

export async function updateExtra(uuid: string, datos: { concept: string; amount: number }): Promise<Result> {
  return guarded(async () => {
    const parsed = cleanConcept(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    await prisma.savingExtra.update({ where: { uuid }, data: parsed })
    refresh()
    return ok
  })
}

export async function deleteExtra(uuid: string): Promise<Result> {
  return guarded(async () => {
    await prisma.savingExtra.delete({ where: { uuid } })
    refresh()
    return ok
  })
}

export async function addTravel(
  yearUuid: string,
  datos: { concept: string; amount: number },
): Promise<Result> {
  return guarded(async () => {
    const parsed = cleanConcept(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    await prisma.travelExpense.create({ data: { yearUuid, ...parsed } })
    refresh()
    return ok
  })
}

export async function updateTravel(
  uuid: string,
  datos: { concept: string; amount: number },
): Promise<Result> {
  return guarded(async () => {
    const parsed = cleanConcept(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    await prisma.travelExpense.update({ where: { uuid }, data: parsed })
    refresh()
    return ok
  })
}

export async function deleteTravel(uuid: string): Promise<Result> {
  return guarded(async () => {
    await prisma.travelExpense.delete({ where: { uuid } })
    refresh()
    return ok
  })
}
