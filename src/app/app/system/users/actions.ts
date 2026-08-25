'use server'

// Server actions de gestión de usuarios (solo administradores): invitar por
// correo (allowlist), cambiar rol, activar/deshabilitar y eliminar. Mismas
// reglas que el user.controller del Portfolio original.
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/auth'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

type Result = { ok: boolean; message?: string }

const ok: Result = { ok: true }
const fail = (message: string): Result => ({ ok: false, message })
const refresh = () => revalidatePath('/app/system/users')

// Ejecuta una acción exigiendo rol admin. Solo los mensajes de AppError son
// aptos para el cliente; el resto (Prisma...) se registra y no se filtra.
async function guarded(fn: (adminUuid: string) => Promise<Result>): Promise<Result> {
  try {
    const session = await requireAdmin()
    return await fn(session.user.uuid)
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
  return guarded(async (adminUuid) => {
    if (uuid === adminUuid && (datos.status === 'DISABLED' || datos.role === 'USER')) {
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
  return guarded(async (adminUuid) => {
    if (uuid === adminUuid) return fail('No puedes eliminarte a ti mismo')
    await prisma.user.delete({ where: { uuid } })
    refresh()
    return ok
  })
}
