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
import { correoConfigurado, enviarCorreo } from '@/lib/correo'
import { hoyMadrid, sumarMeses } from '@/lib/mantenimiento'

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

// ─────────── Tareas de mantenimiento (pestaña Mantenimiento) ───────────

// Valida los campos comunes de alta y edición.
type MantenimientoParse =
  | { error: string }
  | { error?: never; title: string; notes: string | null; intervalMonths: number; nextDue: Date }
function parsearTarea(datos: { title?: string; notes?: string | null; intervalMonths?: number; nextDue?: string }): MantenimientoParse {
  const title = (datos.title ?? '').trim().slice(0, 255)
  if (!title) return { error: 'El título es obligatorio' }
  const meses = Number(datos.intervalMonths)
  if (!Number.isInteger(meses) || meses < 1 || meses > 120) {
    return { error: 'La periodicidad debe ser de 1 a 120 meses' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.nextDue ?? '')) return { error: 'Fecha de vencimiento no válida' }
  const notes = (datos.notes ?? '').trim().slice(0, 5000)
  return {
    title,
    notes: notes === '' ? null : notes,
    intervalMonths: meses,
    nextDue: new Date(`${datos.nextDue}T00:00:00Z`),
  }
}

export async function createMaintenance(datos: {
  title: string
  notes?: string | null
  intervalMonths: number
  nextDue: string
}): Promise<Result> {
  return guarded(async () => {
    const parsed = parsearTarea(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    await prisma.maintenanceTask.create({ data: parsed })
    refresh()
    return ok
  })
}

export async function updateMaintenance(
  uuid: string,
  datos: { title: string; notes?: string | null; intervalMonths: number; nextDue: string },
): Promise<Result> {
  return guarded(async () => {
    const parsed = parsearTarea(datos)
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

// Correo de prueba: verifica el SMTP sin esperar a que venza nada.
export async function sendTestEmail(): Promise<Result> {
  return guarded(async () => {
    if (!correoConfigurado()) {
      return fail('SMTP sin configurar: faltan SMTP_HOST/USER/PASS y ALERT_EMAIL en el entorno')
    }
    try {
      await enviarCorreo(
        '✅ Prueba de avisos de mantenimiento',
        `<p style="margin:0 0 10px">El correo del panel funciona: por aquí llegarán los avisos de
         tareas de mantenimiento vencidas (revisión diaria a las 8:00, reaviso semanal).</p>
         <p style="margin:0">Consejo: crea un filtro en tu correo con la regla
         <em>"el asunto contiene [Panel AO]"</em> para archivarlos en su carpeta.</p>`,
      )
      return ok
    } catch (e) {
      console.error('[mantenimiento] correo de prueba fallido:', e)
      return fail('El envío falló: revisa host, puerto y credenciales SMTP')
    }
  })
}
