'use server'

// Suscripción del navegador a las push: el cliente registra el SW, pide permiso y
// manda la suscripción. Cada navegador es una fila; el endpoint la identifica.
import { headers } from 'next/headers'
import { requireAdmin } from '@/auth'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { clavePublica, pushConfigurado } from '@/lib/push'
import { log } from '@/lib/log'

type Result = { ok: boolean; message?: string }

/** Lo que la UI necesita antes de ofrecer el botón: si hay claves y cuál es la
 *  pública. Sin claves no se ofrece nada. */
export async function estadoPush(): Promise<{ configurado: boolean; clave: string | null }> {
  try {
    await requireAdmin()
  } catch {
    return { configurado: false, clave: null }
  }
  return { configurado: pushConfigurado(), clave: clavePublica() }
}

interface Suscripcion {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

/** Guarda (o refresca) la suscripción de este navegador. */
export async function suscribirPush(sub: Suscripcion): Promise<Result> {
  try {
    const { user } = await requireAdmin()
    const endpoint = (sub.endpoint ?? '').trim()
    const p256dh = sub.keys?.p256dh ?? ''
    const auth = sub.keys?.auth ?? ''
    // El endpoint es una URL del servicio de push del navegador: si no lo es,
    // no viene de donde debería.
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 512) {
      return { ok: false, message: 'Suscripción no válida' }
    }
    if (!p256dh || !auth) return { ok: false, message: 'Suscripción incompleta' }

    const userAgent = (await headers()).get('user-agent')?.slice(0, 255) ?? null
    // `upsert` por endpoint: volver a suscribir el mismo navegador refresca sus
    // claves (el navegador las rota) en vez de duplicar la fila.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userUuid: user.uuid, endpoint, p256dh, auth, userAgent },
      update: { userUuid: user.uuid, p256dh, auth, userAgent },
    })
    return { ok: true }
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message }
    log.error('push', 'alta de suscripción fallida', { error: e })
    return { ok: false, message: 'Error inesperado' }
  }
}

/** Retira la suscripción de este navegador (al desactivar los avisos). */
export async function desuscribirPush(endpoint: string): Promise<Result> {
  try {
    await requireAdmin()
    await prisma.pushSubscription.deleteMany({ where: { endpoint } })
    return { ok: true }
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message }
    log.error('push', 'baja de suscripción fallida', { error: e })
    return { ok: false, message: 'Error inesperado' }
  }
}

/** Manda una notificación de prueba a este navegador (botón "Probar"). */
export async function probarPush(): Promise<Result> {
  try {
    await requireAdmin()
    const { enviarPush } = await import('@/lib/push')
    const n = await enviarPush({
      titulo: 'Avisos activados',
      cuerpo: 'Así se verán los avisos del dashboard.',
      url: '/app',
      tag: 'prueba',
    })
    return n > 0
      ? { ok: true, message: 'Notificación enviada' }
      : { ok: false, message: 'No hay ningún dispositivo suscrito' }
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message }
    log.error('push', 'prueba fallida', { error: e })
    return { ok: false, message: 'Error inesperado' }
  }
}
