// Límite de peticiones por ventana de tiempo (rate limiting).
//
// ⚠ Esto NO reabre el descarte del 28/08: lo que se descartó entonces fue el
// **rate limit por IP en Caddy**, porque exigía compilar un Caddy propio. Esto
// es en la aplicación, no en el proxy, y no necesita nada instalado.
//
// EN MEMORIA, a propósito. Nada de Redis: el despliegue es **un solo
// contenedor** (ver `docker-compose.yml`), así que un contador en memoria ve
// todas las peticiones — que es justo la condición que hace válida esta
// técnica. Consecuencias que hay que tener claras:
//
//   · Se reinicia con el proceso. Para lo que aquí se protege (frenar una
//     ráfaga, no llevar una cuota) da igual: un atacante no gana nada
//     esperando a un despliegue.
//   · Si algún día hubiera dos réplicas, cada una llevaría su cuenta y el
//     límite efectivo se duplicaría. Entonces —y solo entonces— tocaría Redis.
//
// Qué protege y qué no: frena ráfagas y bucles (un Atajo mal configurado en
// reintento, alguien probando tokens, un `while` en el cliente). No sustituye a
// la autenticación ni pretende parar un ataque distribuido, que es cosa del
// proxy de delante.
import { log } from '@/lib/log'

export interface Limite {
  /** Peticiones permitidas dentro de la ventana. */
  max: number
  /** Tamaño de la ventana, en milisegundos. */
  ventanaMs: number
}

/** Sellos de tiempo de las peticiones vistas, por clave. */
const visitas = new Map<string, number[]>()

/**
 * Cada cuánto se barren las claves muertas.
 *
 * Sin esto el Map crece con cada clave nueva (una por token, una por IP) y no
 * baja nunca: en un proceso que vive semanas, eso es una fuga. Se hace por
 * barrido y no con un `setInterval` para no dejar un temporizador vivo en un
 * módulo que también se importa desde los tests.
 */
const BARRIDO_CADA = 5 * 60_000
let ultimoBarrido = Date.now()

function barrer(ahora: number, ventanaMs: number) {
  if (ahora - ultimoBarrido < BARRIDO_CADA) return
  ultimoBarrido = ahora
  for (const [clave, sellos] of visitas) {
    if (!sellos.some((t) => ahora - t < ventanaMs)) visitas.delete(clave)
  }
}

export interface Resultado {
  ok: boolean
  /** Segundos que faltan para que vuelva a haber hueco (solo si `ok` es false). */
  esperaS: number
  /** Peticiones que quedan en esta ventana. */
  quedan: number
}

/**
 * ¿Cabe una petición más para esta clave?
 *
 * Ventana DESLIZANTE y no por bloques fijos: con bloques, se pueden colar `2 ×
 * max` peticiones a caballo entre dos (todas al final de uno y todas al
 * principio del siguiente), que es el fallo clásico de esta técnica.
 *
 * `ahora` se inyecta para poder probarlo sin relojes falsos.
 */
export function limitar(clave: string, limite: Limite, ahora = Date.now()): Resultado {
  barrer(ahora, limite.ventanaMs)

  const desde = ahora - limite.ventanaMs
  const sellos = (visitas.get(clave) ?? []).filter((t) => t > desde)

  if (sellos.length >= limite.max) {
    // El hueco se abre cuando la más antigua salga de la ventana.
    const esperaS = Math.max(1, Math.ceil((sellos[0] + limite.ventanaMs - ahora) / 1000))
    visitas.set(clave, sellos)
    return { ok: false, esperaS, quedan: 0 }
  }

  sellos.push(ahora)
  visitas.set(clave, sellos)
  return { ok: true, esperaS: 0, quedan: limite.max - sellos.length }
}

/** Olvida lo contado para una clave (o todo). Solo para los tests. */
export function reiniciarLimites(clave?: string) {
  if (clave === undefined) visitas.clear()
  else visitas.delete(clave)
}

// ─────────── Los límites del proyecto ───────────
//
// Las cifras están puestas para que NUNCA las note un uso normal y sí frenen
// una ráfaga. Es un dashboard de una persona: si alguna se queda corta, es que
// pasa algo que conviene mirar.

/**
 * API v1. 60 escrituras por minuto es más de lo que un Atajo puede disparar a
 * mano; un bucle de reintentos las gasta en segundos.
 */
export const LIMITE_API: Limite = { max: 60, ventanaMs: 60_000 }

/**
 * Comprobaciones de token FALLIDAS, por IP. Mucho más estrecho: quien acierta
 * el token entra por `LIMITE_API`, así que aquí solo caen los intentos que no
 * valen — y de esos, veinte por minuto ya son un patrón, no un despiste.
 */
export const LIMITE_API_FALLIDO: Limite = { max: 20, ventanaMs: 60_000 }

/**
 * Login. El OAuth de Google ya lo protege él (no hay contraseña que probar),
 * así que esto no es contra la fuerza bruta: es contra el machaque de
 * `/api/auth/*`, que en cada intento escribe en `user_session` y `login_event`.
 */
export const LIMITE_LOGIN: Limite = { max: 30, ventanaMs: 60_000 }

/**
 * Escrituras del dashboard, por usuario. 120/min no lo alcanza nadie pulsando
 * botones; sí lo alcanza un bucle en el cliente o un doble envío desbocado.
 */
export const LIMITE_ACCIONES: Limite = { max: 120, ventanaMs: 60_000 }

/**
 * Clave a partir de la IP de la petición.
 *
 * Detrás de Caddy la IP real viene en `X-Forwarded-For` (el primer valor de la
 * lista: los siguientes los pone quien reenvía). Sin cabecera —o en local— se
 * usa una clave fija: da igual, porque entonces todo viene del mismo sitio.
 *
 * ⚠ Fiarse de esta cabecera solo vale **detrás de un proxy que la reescriba**,
 * que es el caso aquí (Caddy). Si el contenedor se expusiera directamente,
 * cualquiera podría rotarla para saltarse el límite — y entonces la clave
 * tendría que salir de la conexión, no de una cabecera.
 */
export function claveIp(req: Request, prefijo: string): string {
  const xff = req.headers.get('x-forwarded-for')
  const ip = xff?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
  return `${prefijo}:${ip}`
}

/** Registra el frenazo. Se saca aparte para que salga igual desde los tres sitios. */
export function avisarFrenado(scope: string, clave: string, esperaS: number) {
  // A nivel warn: no es un error del programa, pero es lo que se querría ver en
  // los logs si algo va raro. La clave incluye la IP o el uuid del token, que es
  // lo único que permite distinguir un bucle propio de un tercero.
  log.warn(scope, 'petición frenada por el límite', { clave, esperaS })
}
