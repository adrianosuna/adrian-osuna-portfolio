// Notificaciones push web (solo servidor).
//
// Es el mismo aviso que ya manda el cron por correo, pero llegando al móvil en
// el momento. El correo se sigue enviando: son canales distintos y el correo es
// el que queda como registro.
//
// Degrada como GA y el SMTP: **sin claves VAPID no hace nada** y lo dice en el
// log una vez. Las claves se generan con `npx web-push generate-vapid-keys` y
// van en el entorno (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`);
// la pública no es secreta —el navegador la necesita para suscribirse— pero la
// privada sí, así que ninguna se hornea en el build.
//
// ⚠ En iPhone el push exige que la app esté INSTALADA en la pantalla de inicio
// (iOS 16.4+). En Safari a pelo el navegador ni ofrece el permiso.
import 'server-only'
import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site'
import type { Aviso } from '@/lib/inicio'
import { log } from '@/lib/log'

/** Datos que viajan al service worker (los lee su handler de `push`). */
export interface CargaPush {
  titulo: string
  cuerpo: string
  /** A dónde lleva al pulsar la notificación. */
  url: string
  /** Agrupa: un aviso del mismo tipo sustituye al anterior. */
  tag: string
}

const config = () => {
  const publica = process.env.VAPID_PUBLIC_KEY || undefined
  const privada = process.env.VAPID_PRIVATE_KEY || undefined
  // El "subject" identifica al que envía ante el servicio de push: un mailto o
  // la URL del sitio. Si no se pone, se usa la del sitio.
  const subject = process.env.VAPID_SUBJECT || SITE_URL
  return publica && privada ? { publica, privada, subject } : null
}

/** ¿Está el push configurado? (lo consulta la UI para no ofrecer un botón muerto) */
export const pushConfigurado = () => config() !== null

/** La clave pública, que el navegador necesita para suscribirse (no es secreta). */
export const clavePublica = () => config()?.publica ?? null

let avisado = false
/** Prepara web-push. Devuelve false (y avisa UNA vez) si falta configuración. */
function preparar(): boolean {
  const cfg = config()
  if (!cfg) {
    if (!avisado) {
      avisado = true
      log.info('push', 'sin claves VAPID: las notificaciones push quedan inactivas')
    }
    return false
  }
  webpush.setVapidDetails(cfg.subject, cfg.publica, cfg.privada)
  return true
}

/**
 * Manda una notificación a TODOS los navegadores suscritos.
 *
 * Las suscripciones caducadas se limpian solas: cuando el servicio de push
 * responde 404 o 410 (permiso revocado, app desinstalada, navegador
 * reinstalado) la fila se borra. Cualquier otro error se registra y no frena a
 * los demás envíos.
 *
 * Devuelve cuántas notificaciones se entregaron.
 */
export async function enviarPush(carga: CargaPush): Promise<number> {
  if (!preparar()) return 0
  const suscripciones = await prisma.pushSubscription.findMany()
  if (!suscripciones.length) return 0

  const payload = JSON.stringify(carga)
  let entregadas = 0
  const caducadas: string[] = []

  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        entregadas += 1
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) caducadas.push(s.endpoint)
        else log.error('push', 'envío fallido', { status, error: e })
      }
    }),
  )

  if (caducadas.length) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: caducadas } } })
    log.info('push', 'suscripciones caducadas retiradas', { n: caducadas.length })
  }
  return entregadas
}

/**
 * Empuja al móvil los avisos pendientes, en UNA notificación.
 *
 * Una por aviso sería un carrusel de tres notificaciones cada mañana; agrupadas
 * dicen lo mismo en un vistazo y llevan al inicio, donde está la franja
 * completa. Lo llama el cron después de los correos.
 *
 * Devuelve cuántas notificaciones se entregaron (0 si no había nada que avisar).
 */
export async function avisarPush(avisos: Aviso[]): Promise<number> {
  if (!avisos.length) return 0
  const urgentes = avisos.filter((a) => a.gravedad === 'urgente')

  // Con un solo aviso, el titular ES el aviso: no hace falta resumirlo.
  const titulo =
    avisos.length === 1
      ? avisos[0].texto
      : `${avisos.length} cosas requieren tu atención`
  const cuerpo =
    avisos.length === 1
      ? avisos[0].detalle
      : avisos.map((a) => a.texto).join(' · ')

  return enviarPush({
    titulo: urgentes.length ? `⚠ ${titulo}` : titulo,
    cuerpo,
    // Al inicio: es donde está la franja con todos y sus enlaces.
    url: avisos.length === 1 ? avisos[0].href : '/app',
    tag: 'avisos-diarios',
  })
}
