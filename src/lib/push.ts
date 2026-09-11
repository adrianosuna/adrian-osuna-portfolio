// Push web (solo servidor): el mismo aviso del correo, al móvil. Sin claves VAPID no
// hace nada. En iPhone exige la app instalada (iOS 16.4+).
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

/** Manda una notificación a todos los navegadores suscritos. Un 404/410 borra la
 *  suscripción; otros errores se registran sin frenar al resto. */
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

/** Empuja los avisos pendientes en una sola notificación: una por aviso sería un
 *  carrusel. Lo llama el cron tras los correos. Devuelve cuántas se entregaron. */
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
