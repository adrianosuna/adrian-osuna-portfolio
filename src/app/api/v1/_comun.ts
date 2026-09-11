// Piezas comunes de la API v1. Contrato: Bearer ao_..., respuesta siempre JSON
// { ok, ... } | { ok: false, error }, 401/400/405, y Cache-Control: no-store.
import { identificar, type Identidad, type Identificacion } from '@/lib/api-token'
import {
  avisarFrenado,
  claveIp,
  limitar,
  LIMITE_API,
  LIMITE_API_FALLIDO,
} from '@/lib/rate-limit'

/** Lo que como mucho puede tardar en comprobarse un token. */
const TOPE_AUTH_MS = 5000

const CABECERAS = {
  'Cache-Control': 'no-store',
  // Sin CORS: la consumen Atajos y scripts, y sin Access-Control-Allow-Origin una
  // web ajena no puede leer la respuesta aunque tenga el token.
  'X-Content-Type-Options': 'nosniff',
} as const

export const jsonOk = (datos: object, status = 200) =>
  Response.json({ ok: true, ...datos }, { status, headers: CABECERAS })

export const jsonError = (error: string, status: number) =>
  Response.json({ ok: false, error }, { status, headers: CABECERAS })

/** 429 con Retry-After: permite a un Atajo esperar lo justo en vez de reintentar a ciegas. */
const jsonFrenado = (esperaS: number) =>
  Response.json(
    { ok: false, error: `Demasiadas peticiones: espera ${esperaS} s` },
    {
      status: 429,
      headers: { ...CABECERAS, 'Retry-After': String(esperaS) },
    },
  )

/** Autentica la petición: devuelve la identidad o la Response de error (401 con
 *  WWW-Authenticate; 503 si la BD no permite comprobar, ver `api-token.ts`). */
export async function autenticar(
  req: Request,
): Promise<{ identidad: Identidad } | { respuesta: Response }> {
  // Tope de tiempo: con la BD caída las consultas del token esperaban al pool y la
  // petición quedaba 20 s colgada. Mejor un 503 rápido.
  const res = await Promise.race([
    identificar(req.headers.get('authorization')),
    new Promise<Identificacion>((resolve) =>
      setTimeout(() => resolve({ estado: 'indisponible' }), TOPE_AUTH_MS),
    ),
  ])

  // Tope estrecho por IP para todo intento sin identidad (401 y también 503): con la
  // BD caída cada intento cuesta 5 s, y dejarlo fuera del freno era barra libre.
  if (res.estado !== 'ok') {
    const clave = claveIp(req, 'api-fallido')
    const freno = limitar(clave, LIMITE_API_FALLIDO)
    if (!freno.ok) {
      avisarFrenado('api', clave, freno.esperaS)
      return { respuesta: jsonFrenado(freno.esperaS) }
    }
  }

  if (res.estado === 'indisponible') {
    return {
      respuesta: jsonError('Servicio no disponible: inténtalo en un momento', 503),
    }
  }

  if (res.estado === 'invalido') {
    return {
      respuesta: Response.json(
        { ok: false, error: 'Token no válido o ausente' },
        {
          status: 401,
          headers: { ...CABECERAS, 'WWW-Authenticate': 'Bearer realm="api"' },
        },
      ),
    }
  }

  // Con token válido el tope va por token, no por IP: un Atajo desde datos móviles
  // cambia de IP, y así el log dice qué token se desbocó.
  const clave = `api:${res.identidad.tokenUuid}`
  const freno = limitar(clave, LIMITE_API)
  if (!freno.ok) {
    avisarFrenado('api', clave, freno.esperaS)
    return { respuesta: jsonFrenado(freno.esperaS) }
  }

  return { identidad: res.identidad }
}

/** Tope del cuerpo: un JSON de un Atajo son unos cientos de bytes. */
const CUERPO_MAX = 8 * 1024

/** Lee el cuerpo como JSON con tope de tamaño y sin fiarse del Content-Type (los
 *  Atajos no siempre lo ponen bien). Devuelve el objeto o la Response de error. */
export async function leerJson(
  req: Request,
): Promise<{ datos: Record<string, unknown> } | { respuesta: Response }> {
  let texto: string
  try {
    texto = await req.text()
  } catch {
    return { respuesta: jsonError('No se pudo leer el cuerpo', 400) }
  }
  if (texto.length > CUERPO_MAX) {
    return { respuesta: jsonError('Cuerpo demasiado grande', 413) }
  }
  if (!texto.trim()) return { datos: {} }
  try {
    const datos = JSON.parse(texto)
    if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) {
      return { respuesta: jsonError('El cuerpo debe ser un objeto JSON', 400) }
    }
    return { datos: datos as Record<string, unknown> }
  } catch {
    return { respuesta: jsonError('JSON mal formado', 400) }
  }
}

/** Convierte a número lo que llegue: los Atajos mandan "12,50" con coma decimal. */
export function aNumero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const n = Number(v.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Texto de un campo del cuerpo (o undefined si no vino). */
export const aTexto = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : v === undefined || v === null ? undefined : String(v)
