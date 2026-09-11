// Límite de peticiones por ventana deslizante, en memoria: el despliegue es un
// contenedor. Frena ráfagas y bucles; no sustituye a la autenticación.
import { log } from '@/lib/log'

export interface Limite {
  /** Peticiones permitidas dentro de la ventana. */
  max: number
  /** Tamaño de la ventana, en milisegundos. */
  ventanaMs: number
}

/** Sellos de tiempo de las peticiones vistas, por clave. */
const visitas = new Map<string, number[]>()

/** Cada cuánto se barren las claves muertas: sin esto el Map crece sin bajar. Por
 *  barrido y no setInterval, para no dejar un temporizador vivo en los tests. */
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

/** ¿Cabe una petición más? Ventana deslizante, no por bloques: con bloques se cuelan
 *  2 × max a caballo entre dos. `ahora` se inyecta para los tests. */
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

// Límites del proyecto: puestos para que no los note un uso normal y sí frenen una
// ráfaga.

/** API v1: 60 escrituras por minuto es más de lo que un Atajo dispara a mano. */
export const LIMITE_API: Limite = { max: 60, ventanaMs: 60_000 }

/** Comprobaciones de token fallidas, por IP. Estrecho: quien acierta entra por
 *  `LIMITE_API`, y veinte fallos por minuto ya son un patrón. */
export const LIMITE_API_FALLIDO: Limite = { max: 20, ventanaMs: 60_000 }

/** Login: no es contra fuerza bruta (OAuth) sino contra el machaque de
 *  /api/auth/*, que escribe en BD en cada intento. */
export const LIMITE_LOGIN: Limite = { max: 30, ventanaMs: 60_000 }

/** Escrituras del dashboard, por usuario. 120/min solo lo alcanza un bucle o un
 *  doble envío desbocado. */
export const LIMITE_ACCIONES: Limite = { max: 120, ventanaMs: 60_000 }

/** Clave a partir de la IP: detrás de Caddy viene en `X-Forwarded-For` (primer
 *  valor). Fiarse de la cabecera solo vale detrás de un proxy que la reescriba. */
export function claveIp(req: Request, prefijo: string): string {
  const xff = req.headers.get('x-forwarded-for')
  const ip = xff?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
  return `${prefijo}:${ip}`
}

/** Registra el frenazo. Se saca aparte para que salga igual desde los tres sitios. */
export function avisarFrenado(scope: string, clave: string, esperaS: number) {
  // A nivel warn: no es un error del programa, pero es lo que se quiere ver si algo
  // va raro. La clave (IP o token) distingue un bucle propio de un tercero.
  log.warn(scope, 'petición frenada por el límite', { clave, esperaS })
}
