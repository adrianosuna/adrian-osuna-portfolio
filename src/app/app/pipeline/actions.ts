'use server'

// Server actions del pipeline de oportunidades (personal del administrador):
// crear, editar (incluye mover de estado, que se registra en el historial y
// sella/limpia la fecha de cierre), archivar, eliminar y el timeline de
// actividad. Devuelven { ok, message? } y revalidan la página.
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/auth'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

type Result = { ok: boolean; message?: string }

const ok: Result = { ok: true }
const fail = (message: string): Result => ({ ok: false, message })
const refresh = () => revalidatePath('/app/pipeline')

const ESTADOS = ['CONTACTO', 'CONVERSACION', 'PROPUESTA', 'CERRADO', 'DESCARTADO'] as const
type Estado = (typeof ESTADOS)[number]
const TERMINALES: readonly Estado[] = ['CERRADO', 'DESCARTADO']

const ETIQUETA: Record<Estado, string> = {
  CONTACTO: 'Contacto',
  CONVERSACION: 'Conversación',
  PROPUESTA: 'Propuesta',
  CERRADO: 'Cerrado',
  DESCARTADO: 'Descartado',
}

// Tipos de entrada manual del timeline (ESTADO lo escribe solo el sistema).
const TIPOS_MANUALES = ['NOTA', 'LLAMADA', 'EMAIL', 'REUNION'] as const
type TipoManual = (typeof TIPOS_MANUALES)[number]

// Ejecuta una acción exigiendo rol admin. Solo los mensajes de AppError son
// aptos para el cliente; el resto (Prisma...) se registra y no se filtra.
async function guarded(fn: () => Promise<Result>): Promise<Result> {
  try {
    await requireAdmin()
    return await fn()
  } catch (e) {
    if (e instanceof AppError) return fail(e.message)
    console.error('[pipeline]', e)
    return fail('Error inesperado')
  }
}

interface DatosOportunidad {
  title?: string
  company?: string | null
  contact?: string | null
  origin?: string | null
  amount?: number | null
  notes?: string | null
  status?: string
  nextAction?: string | null
  /** 'YYYY-MM-DD' o null (sin seguimiento). */
  nextActionDate?: string | null
}

// Normaliza los campos de texto (recortados, vacío → null), valida el importe
// y parsea la fecha de seguimiento (malformada → null, como en el resto de
// módulos: los campos de fecha propios solo emiten ISO válido).
function limpiar(datos: DatosOportunidad) {
  const texto = (v: string | null | undefined, max: number) => {
    const t = (v ?? '').trim().slice(0, max)
    return t === '' ? null : t
  }
  let amount: number | null = null
  if (datos.amount !== null && datos.amount !== undefined) {
    const n = Number(datos.amount)
    if (!Number.isFinite(n) || n < 0 || n >= 1e10) return { error: 'Importe no válido' }
    amount = n
  }
  const fechaIso = typeof datos.nextActionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datos.nextActionDate)
    ? datos.nextActionDate
    : null
  return {
    company: texto(datos.company, 255),
    contact: texto(datos.contact, 255),
    origin: texto(datos.origin, 100),
    notes: texto(datos.notes, 5000),
    nextAction: texto(datos.nextAction, 255),
    nextActionDate: fechaIso === null ? null : new Date(`${fechaIso}T00:00:00Z`),
    amount,
  }
}

const estadoValido = (v: string | undefined): v is Estado =>
  typeof v === 'string' && (ESTADOS as readonly string[]).includes(v)

export async function createOpportunity(datos: DatosOportunidad): Promise<Result> {
  return guarded(async () => {
    const title = (datos.title ?? '').trim().slice(0, 255)
    if (!title) return fail('El título es obligatorio')
    const campos = limpiar(datos)
    if ('error' in campos && campos.error) return fail(campos.error)
    const status = estadoValido(datos.status) ? datos.status : 'CONTACTO'
    await prisma.opportunity.create({
      data: {
        title,
        ...campos,
        status,
        // Primer apunte del historial: con qué estado nació.
        events: { create: { type: 'ESTADO', detail: `Creada en ${ETIQUETA[status]}` } },
      },
    })
    refresh()
    return ok
  })
}

export async function updateOpportunity(uuid: string, datos: DatosOportunidad): Promise<Result> {
  return guarded(async () => {
    const patch: Record<string, unknown> = {}
    if (datos.title !== undefined) {
      const title = datos.title.trim().slice(0, 255)
      if (!title) return fail('El título es obligatorio')
      patch.title = title
    }
    if (
      datos.company !== undefined || datos.contact !== undefined ||
      datos.origin !== undefined || datos.amount !== undefined ||
      datos.notes !== undefined || datos.nextAction !== undefined ||
      datos.nextActionDate !== undefined
    ) {
      const campos = limpiar(datos)
      if ('error' in campos && campos.error) return fail(campos.error)
      if (datos.company !== undefined) patch.company = campos.company
      if (datos.contact !== undefined) patch.contact = campos.contact
      if (datos.origin !== undefined) patch.origin = campos.origin
      if (datos.amount !== undefined) patch.amount = campos.amount
      if (datos.notes !== undefined) patch.notes = campos.notes
      if (datos.nextAction !== undefined) patch.nextAction = campos.nextAction
      if (datos.nextActionDate !== undefined) {
        patch.nextActionDate = campos.nextActionDate
        // Fecha nueva = ciclo de aviso nuevo (vuelve a avisar cuando venza).
        patch.nextActionNotified = null
      }
    }

    // Cambio de estado: se apunta en el historial; entrar en un estado
    // terminal sella closed_at y retira el seguimiento (ya no hay próxima
    // acción que perseguir); salir de él reabre (y desarchiva).
    let evento: string | null = null
    if (datos.status !== undefined) {
      if (!estadoValido(datos.status)) return fail('Estado no válido')
      const actual = await prisma.opportunity.findUnique({ where: { uuid }, select: { status: true } })
      if (!actual) return fail('Oportunidad no encontrada')
      if (actual.status !== datos.status) {
        patch.status = datos.status
        evento = `${ETIQUETA[actual.status]} → ${ETIQUETA[datos.status]}`
        const cierra = TERMINALES.includes(datos.status)
        const veniaDeCierre = TERMINALES.includes(actual.status)
        if (cierra && !veniaDeCierre) {
          patch.closedAt = new Date()
          patch.nextAction = null
          patch.nextActionDate = null
          patch.nextActionNotified = null
        } else if (!cierra && veniaDeCierre) {
          patch.closedAt = null
          patch.archived = false
        }
      }
    }

    if (!Object.keys(patch).length) return fail('Nada que actualizar')
    await prisma.opportunity.update({
      where: { uuid },
      data: evento
        ? { ...patch, events: { create: { type: 'ESTADO', detail: evento } } }
        : patch,
    })
    refresh()
    return ok
  })
}

/** Archiva (o restaura) una oportunidad. Solo se archivan las terminadas:
 *  el tablero queda limpio y el Histórico conserva la trazabilidad. */
export async function archiveOpportunity(uuid: string, archived: boolean): Promise<Result> {
  return guarded(async () => {
    if (archived) {
      const actual = await prisma.opportunity.findUnique({ where: { uuid }, select: { status: true } })
      if (!actual) return fail('Oportunidad no encontrada')
      if (!TERMINALES.includes(actual.status)) {
        return fail('Solo se archivan oportunidades cerradas o descartadas')
      }
    }
    await prisma.opportunity.update({ where: { uuid }, data: { archived } })
    refresh()
    return ok
  })
}

export async function deleteOpportunity(uuid: string): Promise<Result> {
  return guarded(async () => {
    // El historial (opportunity_event) cae en cascada con el FK.
    await prisma.opportunity.delete({ where: { uuid } })
    refresh()
    return ok
  })
}

// ─────────── Timeline de actividad ───────────

/** Añade una entrada manual al historial (nota, llamada, email o reunión).
 *  Pasa por update de la oportunidad: si no existe falla, y su update_ts se
 *  refresca (la actividad reciente sube la tarjeta en el tablero). */
export async function addOpportunityEvent(
  uuid: string,
  datos: { type: string; detail: string },
): Promise<Result> {
  return guarded(async () => {
    if (!(TIPOS_MANUALES as readonly string[]).includes(datos.type)) {
      return fail('Tipo de actividad no válido')
    }
    const detail = (datos.detail ?? '').trim().slice(0, 500)
    if (!detail) return fail('El detalle es obligatorio')
    await prisma.opportunity.update({
      where: { uuid },
      data: { events: { create: { type: datos.type as TipoManual, detail } } },
    })
    refresh()
    return ok
  })
}

/** Borra una entrada manual del timeline. Los apuntes de estado (los escribe
 *  el sistema) no se borran: son la trazabilidad del embudo. */
export async function deleteOpportunityEvent(uuid: string): Promise<Result> {
  return guarded(async () => {
    const evento = await prisma.opportunityEvent.findUnique({ where: { uuid }, select: { type: true } })
    if (!evento) return fail('Apunte no encontrado')
    if (evento.type === 'ESTADO') return fail('El historial de estados no se puede borrar')
    await prisma.opportunityEvent.delete({ where: { uuid } })
    refresh()
    return ok
  })
}

/** Lee el timeline de una oportunidad (se carga al abrir su detalle). */
export async function getOpportunityEvents(uuid: string): Promise<
  Result & { events?: Array<{ uuid: string; type: string; detail: string; createTs: string }> }
> {
  try {
    await requireAdmin()
    const eventos = await prisma.opportunityEvent.findMany({
      where: { opportunityUuid: uuid },
      orderBy: [{ createTs: 'desc' }, { id: 'desc' }],
    })
    return {
      ok: true,
      events: eventos.map((e) => ({
        uuid: e.uuid,
        type: e.type,
        detail: e.detail,
        createTs: e.createTs.toISOString(),
      })),
    }
  } catch (e) {
    if (e instanceof AppError) return fail(e.message)
    console.error('[pipeline]', e)
    return fail('Error inesperado')
  }
}
