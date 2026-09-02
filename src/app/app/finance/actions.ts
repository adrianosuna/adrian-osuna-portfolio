'use server'

// Server actions del módulo de finanzas (sistema de ahorro anual). Las
// finanzas son personales del administrador: todas exigen rol ADMIN (un
// usuario invitado no debe poder verlas ni tocarlas). Devuelven { ok, message? }
// como las respuestas del backend original y revalidan la página al terminar.
//
// La validación de las entradas NO se escribe aquí: vive en `lib/esquemas.ts`
// (Zod) y se aplica con `validar`. Antes cada action repetía sus propios
// `Number.isFinite` y `.trim().slice(255)`, que es como los topes se van
// separando de las columnas de la BD.
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/auth'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { log } from '@/lib/log'
import { avisarFrenado, limitar, LIMITE_ACCIONES } from '@/lib/rate-limit'
import { AnioEdicion, AnioNuevo, ConceptoImporte, MesesAhorro, Uuid, validar } from '@/lib/esquemas'

type Result = { ok: boolean; message?: string }

const ok: Result = { ok: true }
const fail = (message: string): Result => ({ ok: false, message })
const refresh = () => revalidatePath('/app/finance')

// Ejecuta una acción exigiendo rol admin. Solo los mensajes de AppError son
// aptos para el cliente; el resto (Prisma...) se registra y no se filtra.
async function guarded(fn: () => Promise<Result>): Promise<Result> {
  try {
    const sesionActual = await requireAdmin()
    // Freno por usuario: 120 escrituras por minuto no las alcanza nadie
    // pulsando botones, pero sí un bucle en el cliente o un doble envío
    // desbocado — que es lo único de lo que hay que protegerse aquí, porque
    // llegar hasta este punto ya exige sesión de admin.
    const freno = limitar(`accion:${sesionActual.user.uuid}`, LIMITE_ACCIONES)
    if (!freno.ok) {
      avisarFrenado('finanzas', `accion:${sesionActual.user.uuid}`, freno.esperaS)
      return fail(`Vas muy rápido: espera ${freno.esperaS} s`)
    }
    return await fn()
  } catch (e) {
    if (e instanceof AppError) return fail(e.message)
    log.error('finanzas', 'error inesperado', { error: e })
    return fail('Error inesperado')
  }
}

// ─────────── Años ───────────

export async function createYear(datos: {
  year: number
  goal?: number | null
}): Promise<Result> {
  return guarded(async () => {
    const v = validar(AnioNuevo, datos)
    if (!v.ok) return fail(v.message)
    const { year, goal } = v.datos

    if (await prisma.savingYear.findUnique({ where: { year } })) return fail('Ese año ya existe')
    await prisma.savingYear.create({ data: { year, goal } })
    refresh()
    return ok
  })
}

export async function updateYear(
  uuid: string,
  datos: { year?: number; goal?: number | null },
): Promise<Result> {
  return guarded(async () => {
    const id = validar(Uuid, uuid)
    if (!id.ok) return fail(id.message)
    const v = validar(AnioEdicion, datos)
    if (!v.ok) return fail(v.message)

    const patch: { year?: number; goal?: number | null } = {}
    if (v.datos.year !== undefined) {
      const existing = await prisma.savingYear.findUnique({ where: { year: v.datos.year } })
      if (existing && existing.uuid !== id.datos) return fail('Ese año ya existe')
      patch.year = v.datos.year
    }
    // `in datos` y no `!== undefined`: el objetivo puede venir a null a
    // propósito (quitarlo), y eso sí es un cambio que hay que aplicar.
    if ('goal' in datos) patch.goal = v.datos.goal ?? null
    if (!Object.keys(patch).length) return fail('Nada que actualizar')

    await prisma.savingYear.update({ where: { uuid: id.datos }, data: patch })
    refresh()
    return ok
  })
}

export async function deleteYear(uuid: string): Promise<Result> {
  return guarded(async () => {
    const id = validar(Uuid, uuid)
    if (!id.ok) return fail(id.message)
    // El borrado en cascada de la BD limpia meses, extras y gastos de viaje.
    await prisma.savingYear.delete({ where: { uuid: id.datos } })
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
    const id = validar(Uuid, yearUuid)
    if (!id.ok) return fail(id.message)
    // El esquema descarta las filas con un mes imposible y deja las buenas: es
    // una tabla de doce que se envía completa (ver `MesesAhorro`).
    const v = validar(MesesAhorro, months)
    if (!v.ok) return fail(v.message)

    const yearRecord = await prisma.savingYear.findUnique({ where: { uuid: id.datos } })
    if (!yearRecord) return fail('Ese año no existe')

    await prisma.$transaction(
      v.datos.map((m) =>
        prisma.savingMonth.upsert({
          where: { yearUuid_month: { yearUuid: id.datos, month: m.month } },
          create: { yearUuid: id.datos, ...m },
          update: {
            income: m.income,
            savingGeneral: m.savingGeneral,
            savingTravel: m.savingTravel,
          },
        }),
      ),
    )
    refresh()
    return ok
  })
}

// ─────────── Conceptos: ingresos extra y gastos de viaje ───────────

// Extras y gastos de viaje son la misma forma (`ConceptoImporte`) sobre dos
// tablas. Lo compartido es el ESQUEMA; las consultas van explícitas porque
// `prisma[tabla]` con dos delegados distintos no es invocable en TypeScript
// (sus firmas genéricas no unifican), y forzarlo con un cast solo esconde el
// problema.
const conceptoDe = (datos: unknown) => validar(ConceptoImporte, datos)

export async function addExtra(
  yearUuid: string,
  datos: { concept: string; amount: number },
): Promise<Result> {
  return guarded(async () => {
    const id = validar(Uuid, yearUuid)
    if (!id.ok) return fail(id.message)
    const v = conceptoDe(datos)
    if (!v.ok) return fail(v.message)
    await prisma.savingExtra.create({ data: { yearUuid: id.datos, ...v.datos } })
    refresh()
    return ok
  })
}

export async function updateExtra(
  uuid: string,
  datos: { concept: string; amount: number },
): Promise<Result> {
  return guarded(async () => {
    const id = validar(Uuid, uuid)
    if (!id.ok) return fail(id.message)
    const v = conceptoDe(datos)
    if (!v.ok) return fail(v.message)
    await prisma.savingExtra.update({ where: { uuid: id.datos }, data: v.datos })
    refresh()
    return ok
  })
}

export async function deleteExtra(uuid: string): Promise<Result> {
  return guarded(async () => {
    const id = validar(Uuid, uuid)
    if (!id.ok) return fail(id.message)
    await prisma.savingExtra.delete({ where: { uuid: id.datos } })
    refresh()
    return ok
  })
}

export async function addTravel(
  yearUuid: string,
  datos: { concept: string; amount: number },
): Promise<Result> {
  return guarded(async () => {
    const id = validar(Uuid, yearUuid)
    if (!id.ok) return fail(id.message)
    const v = conceptoDe(datos)
    if (!v.ok) return fail(v.message)
    await prisma.travelExpense.create({ data: { yearUuid: id.datos, ...v.datos } })
    refresh()
    return ok
  })
}

export async function updateTravel(
  uuid: string,
  datos: { concept: string; amount: number },
): Promise<Result> {
  return guarded(async () => {
    const id = validar(Uuid, uuid)
    if (!id.ok) return fail(id.message)
    const v = conceptoDe(datos)
    if (!v.ok) return fail(v.message)
    await prisma.travelExpense.update({ where: { uuid: id.datos }, data: v.datos })
    refresh()
    return ok
  })
}

export async function deleteTravel(uuid: string): Promise<Result> {
  return guarded(async () => {
    const id = validar(Uuid, uuid)
    if (!id.ok) return fail(id.message)
    await prisma.travelExpense.delete({ where: { uuid: id.datos } })
    refresh()
    return ok
  })
}
