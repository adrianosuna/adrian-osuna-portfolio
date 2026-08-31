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
import { sanitizarNota, textoDe } from '@/lib/sanitizar-html'

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
async function guarded(fn: (session: SesionAdmin) => Promise<Result>): Promise<Result> {
  try {
    const session = await requireAdmin()
    return await fn(session)
  } catch (e) {
    if (e instanceof AppError) return fail(e.message)
    console.error('[usuarios]', e)
    return fail('Error inesperado')
  }
}

// Invita un correo (estado INVITED): ese usuario ya puede loguearse con Google.
export async function inviteUser(datos: { email: string; role: 'ADMIN' | 'USER' }): Promise<Result> {
  return guarded(async () => {
    const email = (datos.email || '').trim().toLowerCase()
    if (!email) return fail('El correo es obligatorio')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Correo no válido')

    if (await prisma.user.findUnique({ where: { email } })) {
      return fail('Ese correo ya está dado de alta')
    }

    await prisma.user.create({
      data: { email, role: datos.role === 'ADMIN' ? 'ADMIN' : 'USER', status: 'INVITED' },
    })
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

// ─────────── Mantenimiento: ámbitos y tareas (pestaña Mantenimiento) ───────────

const NOMBRE_AMBITO_MAX = 60

/** Crea un ámbito (servidor, casa, vehículo, moto, salud...). */
export async function createAmbito(datos: { name?: string }): Promise<Result> {
  return guarded(async () => {
    const name = (datos.name ?? '').trim().slice(0, NOMBRE_AMBITO_MAX)
    if (!name) return fail('El nombre es obligatorio')
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
    const name = (datos.name ?? '').trim().slice(0, NOMBRE_AMBITO_MAX)
    if (!name) return fail('El nombre es obligatorio')
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
      intervalMonths: number
      nextDue: Date
    }
async function parsearTarea(datos: {
  title?: string
  scopeUuid?: string
  notes?: string | null
  intervalMonths?: number
  nextDue?: string
}): Promise<MantenimientoParse> {
  const title = (datos.title ?? '').trim().slice(0, 255)
  if (!title) return { error: 'El título es obligatorio' }
  const meses = Number(datos.intervalMonths)
  if (!Number.isInteger(meses) || meses < 1 || meses > 120) {
    return { error: 'La periodicidad debe ser de 1 a 120 meses' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.nextDue ?? '')) return { error: 'Fecha de vencimiento no válida' }
  // El ámbito tiene que existir: ahora es una fila, no un valor de enum.
  const scopeUuid = (datos.scopeUuid ?? '').trim()
  if (!scopeUuid) return { error: 'Elige un ámbito' }
  if (!(await prisma.maintenanceScope.findUnique({ where: { uuid: scopeUuid } }))) {
    return { error: 'Ese ámbito no existe' }
  }
  const notes = (datos.notes ?? '').trim().slice(0, 5000)
  return {
    title,
    scopeUuid,
    notes: notes === '' ? null : notes,
    intervalMonths: meses,
    nextDue: new Date(`${datos.nextDue}T00:00:00Z`),
  }
}

export async function createMaintenance(datos: {
  title: string
  scopeUuid?: string
  notes?: string | null
  intervalMonths: number
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
    intervalMonths: number
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

// Marca la tarea como hecha hoy y encadena el siguiente vencimiento.
export async function completeMaintenance(uuid: string): Promise<Result> {
  return guarded(async () => {
    const tarea = await prisma.maintenanceTask.findUnique({ where: { uuid } })
    if (!tarea) return fail('Esa tarea no existe')
    const hoy = hoyMadrid()
    await prisma.maintenanceTask.update({
      where: { uuid },
      data: {
        lastDone: new Date(`${hoy}T00:00:00Z`),
        nextDue: new Date(`${sumarMeses(hoy, tarea.intervalMonths)}T00:00:00Z`),
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

const NOTA_TITULO_MAX = 255
// El contenido es HTML del editor, así que el tope va más alto que el texto que
// representa (etiquetas de por medio). Cabe un apunte largo lejos del límite de
// TEXT (64 KB) y evita que un cliente manipulado llene la columna.
const NOTA_CONTENIDO_MAX = 50_000

// Título (opcional) y contenido HTML, comunes al alta y la edición. El HTML se
// SANEA aquí (servidor) antes de guardar: es el punto donde pasa a ser de fiar,
// así que pintarlo luego con dangerouslySetInnerHTML es seguro. La nota vacía se
// detecta sobre el TEXTO (un editor "vacío" deja `<br>` o `<div></div>`).
type NotaParse = { error: string } | { error?: never; title: string | null; content: string }
const limpiarNota = (datos: { title?: string; content?: string }): NotaParse => {
  const content = sanitizarNota((datos.content ?? '').slice(0, NOTA_CONTENIDO_MAX))
  if (!textoDe(content)) return { error: 'La nota no puede estar vacía' }
  const title = (datos.title ?? '').trim().slice(0, NOTA_TITULO_MAX)
  return { title: title || null, content }
}

export async function createNote(datos: { title?: string; content?: string }): Promise<Result> {
  return guarded(async () => {
    const parsed = limpiarNota(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    await prisma.note.create({ data: { title: parsed.title, content: parsed.content } })
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
    await prisma.note.update({ where: { uuid }, data: { title: parsed.title, content: parsed.content } })
    refresh()
    return ok
  })
}

export async function deleteNote(uuid: string): Promise<Result> {
  return guarded(async () => {
    await prisma.note.delete({ where: { uuid } })
    refresh()
    return ok
  })
}
