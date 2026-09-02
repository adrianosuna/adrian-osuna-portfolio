'use server'

// Server actions del pipeline de oportunidades (personal del administrador):
// crear, editar (incluye mover de estado, que se registra en el historial y
// sella/limpia la fecha de cierre), archivar, eliminar y el timeline de
// actividad. Devuelven { ok, message? } y revalidan la página.
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/auth'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { log } from '@/lib/log'
import { avisarFrenado, limitar, LIMITE_ACCIONES } from '@/lib/rate-limit'
import type { z } from 'zod'
import {
  CamposOportunidad,
  EstadoOportunidad,
  TituloOportunidad,
  validar,
} from '@/lib/esquemas'

type Result = { ok: boolean; message?: string }

const ok: Result = { ok: true }
const fail = (message: string): Result => ({ ok: false, message })
const refresh = () => revalidatePath('/app/pipeline')

// El tipo sale del esquema compartido: la lista de estados se declara UNA vez
// (en `lib/esquemas.ts`) y aquí solo se lee.
type Estado = z.infer<typeof EstadoOportunidad>
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
async function guarded<T extends Result>(fn: () => Promise<T>): Promise<T | Result> {
  try {
    const sesionActual = await requireAdmin()
    // Freno por usuario: 120 escrituras por minuto no las alcanza nadie
    // pulsando botones, pero sí un bucle en el cliente o un doble envío
    // desbocado — que es lo único de lo que hay que protegerse aquí, porque
    // llegar hasta este punto ya exige sesión de admin.
    const freno = limitar(`accion:${sesionActual.user.uuid}`, LIMITE_ACCIONES)
    if (!freno.ok) {
      avisarFrenado('pipeline', `accion:${sesionActual.user.uuid}`, freno.esperaS)
      return fail(`Vas muy rápido: espera ${freno.esperaS} s`)
    }
    return await fn()
  } catch (e) {
    if (e instanceof AppError) return fail(e.message)
    log.error('pipeline', 'error inesperado', { error: e })
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

/**
 * Normaliza los campos de la oportunidad con el esquema compartido
 * (`OportunidadEdicion`): textos recortados y vacío → null, importe validado
 * y fecha de seguimiento pasada a Date.
 *
 * Devuelve `{ error }` para que las actions contesten con el mensaje, igual
 * que antes de tener Zod: el contrato hacia el cliente no cambia.
 */
function limpiar(datos: DatosOportunidad) {
  const v = validar(CamposOportunidad, datos)
  if (!v.ok) return { error: v.message }
  const d = v.datos
  return {
    company: d.company ?? null,
    contact: d.contact ?? null,
    origin: d.origin ?? null,
    notes: d.notes ?? null,
    nextAction: d.nextAction ?? null,
    nextActionDate: d.nextActionDate ? new Date(`${d.nextActionDate}T00:00:00Z`) : null,
    amount: d.amount ?? null,
  }
}

const estadoValido = (v: string | undefined): v is Estado =>
  EstadoOportunidad.safeParse(v).success

export async function createOpportunity(datos: DatosOportunidad): Promise<Result> {
  return guarded(async () => {
    const t = validar(TituloOportunidad, datos.title)
    if (!t.ok) return fail(t.message)
    const title = t.datos
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
      const t = validar(TituloOportunidad, datos.title)
      if (!t.ok) return fail(t.message)
      patch.title = t.datos
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

/**
 * Lo necesario para devolver una oportunidad borrada a su sitio, **con su
 * historial**: el FK de `opportunity_event` es CASCADE, así que borrarla se
 * lleva también el timeline. Sin traerlo aquí, "Deshacer" devolvería la ficha
 * vacía de historia, que es peor que no ofrecer deshacer.
 */
export interface OportunidadRestaurable {
  uuid: string
  title: string
  company: string | null
  contact: string | null
  origin: string | null
  amount: number | null
  notes: string | null
  status: string
  nextAction: string | null
  nextActionDate: string | null // 'YYYY-MM-DD'
  closedAt: string | null // ISO
  archived: boolean
  createTs: string // ISO
  eventos: Array<{
    uuid: string
    type: string
    detail: string
    createTs: string // ISO
  }>
}

/** Borra una oportunidad y devuelve con qué restaurarla (con su historial). */
export async function deleteOpportunity(
  uuid: string,
): Promise<Result & { deshacer?: OportunidadRestaurable }> {
  return guarded(async () => {
    const fila = await prisma.opportunity.findUnique({
      where: { uuid },
      include: { events: { orderBy: { id: 'asc' } } },
    })
    if (!fila) return fail('Esa oportunidad ya no existe')
    // El historial (opportunity_event) cae en cascada con el FK.
    await prisma.opportunity.delete({ where: { uuid } })
    refresh()
    return {
      ok: true,
      deshacer: {
        uuid: fila.uuid,
        title: fila.title,
        company: fila.company,
        contact: fila.contact,
        origin: fila.origin,
        amount: fila.amount === null ? null : Number(fila.amount),
        notes: fila.notes,
        status: fila.status,
        nextAction: fila.nextAction,
        nextActionDate: fila.nextActionDate
          ? fila.nextActionDate.toISOString().slice(0, 10)
          : null,
        closedAt: fila.closedAt ? fila.closedAt.toISOString() : null,
        archived: fila.archived,
        createTs: fila.createTs.toISOString(),
        eventos: fila.events.map((e) => ({
          uuid: e.uuid,
          type: e.type,
          detail: e.detail,
          createTs: e.createTs.toISOString(),
        })),
      },
    }
  })
}

/** Devuelve a su sitio una oportunidad recién borrada, con su historial. */
export async function restaurarOportunidad(datos: OportunidadRestaurable): Promise<Result> {
  return guarded(async () => {
    if (await prisma.opportunity.findUnique({ where: { uuid: datos.uuid } })) {
      refresh()
      return ok
    }
    if (!estadoValido(datos.status)) return fail('Estado no válido')
    // Los eventos incluyen los de ESTADO (los apunta el sistema), no solo los
    // manuales: al restaurar hay que admitir los cinco tipos.
    const TIPOS_EVENTO = ['ESTADO', ...TIPOS_MANUALES] as const
    type TipoEvento = (typeof TIPOS_EVENTO)[number]
    const eventos = (datos.eventos ?? []).filter((e): e is typeof e & { type: TipoEvento } =>
      (TIPOS_EVENTO as readonly string[]).includes(e.type),
    )

    await prisma.$transaction([
      prisma.opportunity.create({
        data: {
          uuid: datos.uuid,
          title: datos.title.slice(0, 255),
          company: datos.company,
          contact: datos.contact,
          origin: datos.origin,
          amount: datos.amount,
          notes: datos.notes,
          status: datos.status,
          nextAction: datos.nextAction,
          nextActionDate: datos.nextActionDate
            ? new Date(`${datos.nextActionDate}T00:00:00Z`)
            : null,
          closedAt: datos.closedAt ? new Date(datos.closedAt) : null,
          archived: Boolean(datos.archived),
          createTs: new Date(datos.createTs),
        },
      }),
      // El historial vuelve con sus fechas: es lo que le da sentido.
      prisma.opportunityEvent.createMany({
        data: eventos.map((e) => ({
          uuid: e.uuid,
          opportunityUuid: datos.uuid,
          type: e.type,
          detail: e.detail.slice(0, 500),
          createTs: new Date(e.createTs),
        })),
      }),
    ])
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
    log.error('pipeline', 'error inesperado', { error: e })
    return fail('Error inesperado')
  }
}
