'use server'

// Server actions del Panel de control: los refrescos automáticos del cliente
// (usuarios en tiempo real de Visitas y recursos de la máquina de Servidor) y
// la gestión de usuarios de la pestaña Usuarios — invitar por correo
// (allowlist), cambiar rol, activar/deshabilitar y eliminar, mismas reglas
// que el user.controller del Portfolio original.
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/auth'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { visitantesAhora } from '@/lib/ga'
import { snapshotServidor, type ServidorSnapshot } from '@/lib/infra'
import { hoyMadrid } from '@/lib/mantenimiento'
import { sumarMeses } from '@/lib/fechas'
import { alternarTarea } from '@/lib/sanitizar-html'
import { log } from '@/lib/log'
import { avisarFrenado, limitar, LIMITE_ACCIONES } from '@/lib/rate-limit'
import { altaNota, limpiarNotaHtml } from '@/lib/alta-nota'
import { crearToken, revocarToken } from '@/lib/api-token'
import {
  Ambito,
  indiceTarea,
  TareaAlta,
  TokenNuevo,
  UsuarioEdicion,
  UsuarioInvitado,
  validar,
} from '@/lib/esquemas'

export async function leerUsuariosAhora(): Promise<number | null> {
  try {
    await requireAdmin()
    return await visitantesAhora()
  } catch {
    // Sin sesión o sin permisos: el cliente simplemente conserva el último valor.
    return null
  }
}

export async function leerRecursos(): Promise<ServidorSnapshot | null> {
  try {
    await requireAdmin()
    return await snapshotServidor()
  } catch {
    return null
  }
}

// ─────────── Gestión de usuarios (pestaña Usuarios) ───────────

type Result = { ok: boolean; message?: string }

const ok: Result = { ok: true }
const fail = (message: string): Result => ({ ok: false, message })
const refresh = () => revalidatePath('/app/panel')

// Ejecuta una acción exigiendo rol admin (recibe la sesión del propio admin).
// Solo los mensajes de AppError son aptos para el cliente; el resto (Prisma...)
// se registra y no se filtra.
type SesionAdmin = Awaited<ReturnType<typeof requireAdmin>>
async function guarded<T extends Result>(
  fn: (session: SesionAdmin) => Promise<T>,
): Promise<T | Result> {
  try {
    const sesionActual = await requireAdmin()
    // Freno por usuario: 120 escrituras por minuto no las alcanza nadie
    // pulsando botones, pero sí un bucle en el cliente o un doble envío
    // desbocado — que es lo único de lo que hay que protegerse aquí, porque
    // llegar hasta este punto ya exige sesión de admin.
    const freno = limitar(`accion:${sesionActual.user.uuid}`, LIMITE_ACCIONES)
    if (!freno.ok) {
      avisarFrenado('usuarios', `accion:${sesionActual.user.uuid}`, freno.esperaS)
      return fail(`Vas muy rápido: espera ${freno.esperaS} s`)
    }
    return await fn(sesionActual)
  } catch (e) {
    if (e instanceof AppError) return fail(e.message)
    log.error('usuarios', 'error inesperado', { error: e })
    return fail('Error inesperado')
  }
}

// Invita un correo (estado INVITED): ese usuario ya puede loguearse con Google.
export async function inviteUser(datos: { email: string; role: 'ADMIN' | 'USER' }): Promise<Result> {
  return guarded(async () => {
    const v = validar(UsuarioInvitado, datos)
    if (!v.ok) return fail(v.message)
    const { email, role } = v.datos

    if (await prisma.user.findUnique({ where: { email } })) {
      return fail('Ese correo ya está dado de alta')
    }

    await prisma.user.create({ data: { email, role, status: 'INVITED' } })
    refresh()
    return ok
  })
}

// Cambia rol y/o estado. Un admin no puede revocarse su propio acceso.
export async function updateUser(
  uuid: string,
  datos: { role?: 'ADMIN' | 'USER'; status?: 'ACTIVE' | 'DISABLED' },
): Promise<Result> {
  return guarded(async ({ user: admin }) => {
    const v = validar(UsuarioEdicion, datos)
    if (!v.ok) return fail(v.message)
    if (uuid === admin.uuid && (datos.status === 'DISABLED' || datos.role === 'USER')) {
      return fail('No puedes revocar tu propio acceso de administrador')
    }

    const patch: { role?: 'ADMIN' | 'USER'; status?: 'ACTIVE' | 'DISABLED' } = {}
    if (datos.role) patch.role = datos.role === 'ADMIN' ? 'ADMIN' : 'USER'
    if (datos.status) patch.status = datos.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'
    if (!Object.keys(patch).length) return fail('Nada que actualizar')

    // La "revocación de sesiones" es automática: el callback jwt reverifica el
    // usuario en BD en cada petición, así que deshabilitar corta el acceso ya.
    await prisma.user.update({ where: { uuid }, data: patch })
    refresh()
    return ok
  })
}

export async function removeUser(uuid: string): Promise<Result> {
  return guarded(async ({ user: admin }) => {
    if (uuid === admin.uuid) return fail('No puedes eliminarte a ti mismo')
    // Sin FK físico (colaciones dispares local/prod): sus sesiones se limpian aquí.
    await prisma.$transaction([
      prisma.userSession.deleteMany({ where: { userUuid: uuid } }),
      prisma.user.delete({ where: { uuid } }),
    ])
    refresh()
    return ok
  })
}

// Cierra una sesión remotamente: al borrar la fila, el callback jwt de esa
// sesión deja de encontrarla y la corta en su siguiente petición.
export async function closeSession(uuid: string): Promise<Result> {
  return guarded(async (session) => {
    if (session.sessionUuid === uuid) {
      return fail('Es tu sesión actual: usa "Cerrar sesión" del menú')
    }
    await prisma.userSession.delete({ where: { uuid } })
    refresh()
    return ok
  })
}

/**
 * Cierra TODAS las sesiones menos la propia.
 *
 * Es el botón de pánico: un portátil perdido, un navegador ajeno, o la duda
 * de "¿me dejé la sesión abierta en algún sitio?". Cerrarlas una a una
 * funciona, pero cuando hace falta esto hace falta en un clic.
 *
 * La propia se excluye a propósito: cerrarla también dejaría al admin fuera
 * de la pantalla desde la que acaba de pulsar, sin poder comprobar el
 * resultado. Para la suya está "Cerrar sesión" del menú.
 */
export async function closeAllSessions(): Promise<Result & { cerradas?: number }> {
  return guarded(async (session) => {
    const { count } = await prisma.userSession.deleteMany({
      where: session.sessionUuid ? { uuid: { not: session.sessionUuid } } : {},
    })
    refresh()
    return { ok: true, cerradas: count }
  })
}

// ─────────── Tokens de la API (sub-pestaña API) ───────────

/**
 * Crea un token y devuelve su valor EN CLARO: es la única vez que existe
 * (en la BD solo queda su SHA-256). Quien llama tiene que enseñarlo ya.
 */
export async function createApiToken(datos: {
  name?: string
}): Promise<Result & { token?: string }> {
  return guarded(async ({ user }) => {
    const v = validar(TokenNuevo, datos)
    if (!v.ok) return fail('Ponle un nombre para reconocerlo')
    const { name } = v.datos
    const creado = await crearToken(user.uuid, name)
    refresh()
    return { ok: true, token: creado.token }
  })
}

/** Revoca un token: borrarlo ES revocarlo, no hay estado intermedio. */
export async function revokeApiToken(uuid: string): Promise<Result> {
  return guarded(async ({ user }) => {
    const fuera = await revocarToken(uuid, user.uuid)
    if (!fuera) return fail('Ese token ya no existe')
    refresh()
    return ok
  })
}

// ─────────── Mantenimiento: ámbitos y tareas (pestaña Mantenimiento) ───────────

/** Crea un ámbito (servidor, casa, vehículo, moto, salud...). */
export async function createAmbito(datos: { name?: string }): Promise<Result> {
  return guarded(async () => {
    const v = validar(Ambito, datos)
    if (!v.ok) return fail(v.message)
    const { name } = v.datos
    if (await prisma.maintenanceScope.findFirst({ where: { name } })) {
      return fail('Ya existe un ámbito con ese nombre')
    }
    await prisma.maintenanceScope.create({ data: { name } })
    refresh()
    return ok
  })
}

/** Renombra un ámbito: sus tareas lo siguen (apuntan por uuid, no por nombre). */
export async function updateAmbito(uuid: string, datos: { name?: string }): Promise<Result> {
  return guarded(async () => {
    const v = validar(Ambito, datos)
    if (!v.ok) return fail(v.message)
    const { name } = v.datos
    const otro = await prisma.maintenanceScope.findFirst({ where: { name } })
    if (otro && otro.uuid !== uuid) return fail('Ya existe un ámbito con ese nombre')
    await prisma.maintenanceScope.update({ where: { uuid }, data: { name } })
    refresh()
    return ok
  })
}

/**
 * Borra un ámbito, PERO solo si no lo usa ninguna tarea.
 *
 * El FK es SET NULL, así que borrarlo dejaría tareas sin ámbito en silencio.
 * Con pocas tareas, reasignarlas a mano es trivial; perder la clasificación sin
 * enterarse, no.
 */
export async function deleteAmbito(uuid: string): Promise<Result> {
  return guarded(async () => {
    const tareas = await prisma.maintenanceTask.count({ where: { scopeUuid: uuid } })
    if (tareas > 0) {
      return fail(
        `No se puede borrar: lo usa${tareas === 1 ? ' 1 tarea' : `n ${tareas} tareas`}. Cámbialas de ámbito primero.`,
      )
    }
    await prisma.maintenanceScope.delete({ where: { uuid } })
    refresh()
    return ok
  })
}

// ─────────── Tareas ───────────

// Valida los campos comunes de alta y edición.
type MantenimientoParse =
  | { error: string }
  | {
      error?: never
      title: string
      scopeUuid: string
      notes: string | null
      /** null = no se repite: es un recordatorio puntual. */
      intervalMonths: number | null
      nextDue: Date
    }
async function parsearTarea(datos: {
  title?: string
  scopeUuid?: string
  notes?: string | null
  intervalMonths?: number | null
  nextDue?: string
}): Promise<MantenimientoParse> {
  const v = validar(TareaAlta, datos)
  if (!v.ok) return { error: v.message }
  const d = v.datos

  // El ámbito tiene que EXISTIR: es una fila, no un valor de enum, así que
  // esto no lo puede comprobar el esquema.
  if (!d.scopeUuid) return { error: 'Elige un ámbito' }
  if (!(await prisma.maintenanceScope.findUnique({ where: { uuid: d.scopeUuid } }))) {
    return { error: 'Ese ámbito no existe' }
  }

  return {
    title: d.title,
    scopeUuid: d.scopeUuid,
    notes: d.notes,
    intervalMonths: d.intervalMonths,
    nextDue: new Date(`${d.nextDue}T00:00:00Z`),
  }
}

export async function createMaintenance(datos: {
  title: string
  scopeUuid?: string
  notes?: string | null
  /** null = no se repite: recordatorio puntual. */
  intervalMonths: number | null
  nextDue: string
}): Promise<Result> {
  return guarded(async () => {
    const parsed = await parsearTarea(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    await prisma.maintenanceTask.create({ data: parsed })
    refresh()
    return ok
  })
}

export async function updateMaintenance(
  uuid: string,
  datos: {
    title: string
    scopeUuid?: string
    notes?: string | null
    /** null = no se repite: recordatorio puntual. */
    intervalMonths: number | null
    nextDue: string
  },
): Promise<Result> {
  return guarded(async () => {
    const parsed = await parsearTarea(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    // Editar el vencimiento a mano resetea el aviso: si vuelve a vencer, avisa.
    await prisma.maintenanceTask.update({ where: { uuid }, data: { ...parsed, lastNotified: null } })
    refresh()
    return ok
  })
}

/**
 * Marca la tarea como hecha hoy.
 *
 * Una tarea RECURRENTE encadena su siguiente vencimiento. Un recordatorio
 * PUNTUAL (sin periodicidad) se queda hecho: su fecha no se mueve y, con
 * `lastDone` puesto, la lista ya lo da por cumplido. No se borra a propósito
 * — queda el rastro de cuándo se hizo.
 */
export async function completeMaintenance(uuid: string): Promise<Result> {
  return guarded(async () => {
    const tarea = await prisma.maintenanceTask.findUnique({ where: { uuid } })
    if (!tarea) return fail('Esa tarea no existe')
    const hoy = hoyMadrid()
    const meses = tarea.intervalMonths
    await prisma.maintenanceTask.update({
      where: { uuid },
      data: {
        lastDone: new Date(`${hoy}T00:00:00Z`),
        ...(meses === null
          ? {}
          : { nextDue: new Date(`${sumarMeses(hoy, meses)}T00:00:00Z`) }),
        lastNotified: null,
      },
    })
    refresh()
    return ok
  })
}

export async function deleteMaintenance(uuid: string): Promise<Result> {
  return guarded(async () => {
    await prisma.maintenanceTask.delete({ where: { uuid } })
    refresh()
    return ok
  })
}

// (El 26/08/2026 se retiró la acción del botón "Probar correo": el SMTP ya
// quedó verificado en producción y el botón se pulsaba sin querer.)

// ─────────── Notas (pestaña Notas) ───────────

// Las reglas de la nota (título, tope del HTML y su saneado) viven en
// `@/lib/alta-nota`, porque las comparte la API de los Atajos: el saneado del
// HTML es justo lo que no puede tener dos definiciones.
const limpiarNota = limpiarNotaHtml

export async function createNote(datos: { title?: string; content?: string }): Promise<Result> {
  return guarded(async () => {
    const res = await altaNota(datos)
    if (res.error !== undefined) return fail(res.error)
    refresh()
    return ok
  })
}

export async function updateNote(
  uuid: string,
  datos: { title?: string; content?: string },
): Promise<Result> {
  return guarded(async () => {
    const parsed = limpiarNota(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    await prisma.note.update({
      where: { uuid },
      data: { title: parsed.title, content: parsed.content },
    })
    refresh()
    return ok
  })
}

/** Fija o suelta una nota (las fijadas salen primero y no se hunden). */
export async function pinNote(uuid: string, pinned: boolean): Promise<Result> {
  return guarded(async () => {
    await prisma.note.update({ where: { uuid }, data: { pinned: Boolean(pinned) } })
    refresh()
    return ok
  })
}

/**
 * Marca o desmarca el ítem `indice` de la checklist de una nota.
 *
 * El toggle se aplica en el SERVIDOR sobre el HTML guardado (que ya está
 * saneado) en lugar de reenviar el documento entero desde el cliente: así
 * marcar una tarea no puede convertirse en una vía para reescribir la nota.
 */
export async function toggleNotaTarea(uuid: string, indice: number): Promise<Result> {
  return guarded(async () => {
    const i = validar(indiceTarea, indice)
    if (!i.ok) return fail(i.message)
    const nota = await prisma.note.findUnique({ where: { uuid }, select: { content: true } })
    if (!nota) return fail('Esa nota no existe')
    const nuevo = alternarTarea(nota.content, i.datos)
    if (nuevo === null) return fail('Esa tarea ya no existe: recarga la página')
    await prisma.note.update({ where: { uuid }, data: { content: nuevo } })
    refresh()
    return ok
  })
}

/** Lo necesario para devolver una nota borrada a su sitio (con su uuid). */
export interface NotaRestaurable {
  uuid: string
  title: string | null
  content: string
  pinned: boolean
  createTs: string // ISO
}

/** Borra una nota y devuelve con qué restaurarla (aviso con "Deshacer"). */
export async function deleteNote(
  uuid: string,
): Promise<Result & { deshacer?: NotaRestaurable }> {
  return guarded(async () => {
    const fila = await prisma.note.findUnique({ where: { uuid } })
    if (!fila) return fail('Esa nota ya no existe')
    await prisma.note.delete({ where: { uuid } })
    refresh()
    return {
      ok: true,
      deshacer: {
        uuid: fila.uuid,
        title: fila.title,
        content: fila.content,
        pinned: fila.pinned,
        createTs: fila.createTs.toISOString(),
      },
    }
  })
}

/** Devuelve a su sitio una nota recién borrada. */
export async function restaurarNota(datos: NotaRestaurable): Promise<Result> {
  return guarded(async () => {
    // El contenido se vuelve a sanear: viene de un viaje por el cliente.
    const parsed = limpiarNota({ title: datos.title ?? '', content: datos.content })
    if (parsed.error !== undefined) return fail(parsed.error)
    if (await prisma.note.findUnique({ where: { uuid: datos.uuid } })) {
      refresh()
      return ok
    }
    await prisma.note.create({
      data: {
        uuid: datos.uuid,
        title: parsed.title,
        content: parsed.content,
        pinned: Boolean(datos.pinned),
        // Se conserva la fecha de creación; la de edición es de ahora, que es
        // la verdad: la nota se acaba de tocar.
        createTs: new Date(datos.createTs),
      },
    })
    refresh()
    return ok
  })
}
