// Piezas comunes de la API v1 (Atajos de iOS y automatizaciones).
//
// Contrato, para que un Atajo pueda leerlo sin adivinar:
//   · Autenticación: cabecera `Authorization: Bearer ao_...`
//   · Respuesta SIEMPRE JSON: `{ ok: true, ... }` o `{ ok: false, error: "..." }`
//   · 401 sin token o con token inválido · 400 si los datos no valen ·
//     405 si el método no es el suyo · 200/201 si va bien.
//
// `Cache-Control: no-store` en todo: son datos personales y respuestas de
// escritura; que ningún intermediario las guarde.
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
  // La API la consumen Atajos y scripts, no navegadores de terceros: no se
  // habilita CORS. Sin `Access-Control-Allow-Origin`, una web ajena no puede
  // leer la respuesta aunque robe el token.
  'X-Content-Type-Options': 'nosniff',
} as const

export const jsonOk = (datos: object, status = 200) =>
  Response.json({ ok: true, ...datos }, { status, headers: CABECERAS })

export const jsonError = (error: string, status: number) =>
  Response.json({ ok: false, error }, { status, headers: CABECERAS })

/**
 * 429 con `Retry-After`: es lo que manda el estándar, y lo que permite a un
 * Atajo o a un script esperar lo justo en vez de reintentar a ciegas.
 */
const jsonFrenado = (esperaS: number) =>
  Response.json(
    { ok: false, error: `Demasiadas peticiones: espera ${esperaS} s` },
    {
      status: 429,
      headers: { ...CABECERAS, 'Retry-After': String(esperaS) },
    },
  )

/**
 * Autentica la petición. Devuelve la identidad, o la Response de error ya
 * lista para devolver.
 *
 * `WWW-Authenticate` en el 401: es lo que dice el estándar y lo que ayuda a
 * depurar un Atajo que manda mal la cabecera.
 *
 * Si la comprobación no se pudo hacer (BD caída) sale un **503**, no un 401:
 * ver `Identificacion` en `api-token.ts`.
 */
export async function autenticar(
  req: Request,
): Promise<{ identidad: Identidad } | { respuesta: Response }> {
  // Tope de tiempo. Con la BD inalcanzable, las consultas del token esperan al
  // pool (10 s cada una) y la petición se quedaba VEINTE segundos colgada —lo
  // midió el e2e—. Un Atajo del iPhone que no responde en unos segundos ya ha
  // fallado para quien lo pulsó: mejor un 503 rápido que un acierto tardío.
  const res = await Promise.race([
    identificar(req.headers.get('authorization')),
    new Promise<Identificacion>((resolve) =>
      setTimeout(() => resolve({ estado: 'indisponible' }), TOPE_AUTH_MS),
    ),
  ])

  // Tope ESTRECHO por IP para todo intento que NO acaba en una identidad:
  // token inválido (401) o comprobación imposible (503). Quien acierta el
  // token pasa por el tope normal, mucho más ancho, así que aquí solo caen
  // los que no han entrado — y veinte por minuto ya son un patrón.
  //
  // ⚠ El 503 cuenta TAMBIÉN, y es importante: con la base de datos caída
  // cada intento se come el tope de 5 s de la autenticación, así que es
  // justo cuando más barato resulta machacar y cuando más caro sale
  // atender. Dejarlo fuera del freno convertía una caída de la BD en una
  // barra libre. Lo encontró el e2e, que corre sin BD.
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

  // Token válido: el tope va por TOKEN y no por IP. Es lo que corresponde
  // cuando ya se sabe quién llama —un Atajo desde datos móviles cambia de IP
  // cada rato— y además permite ver en el log qué token se desbocó.
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

/**
 * Lee el cuerpo como JSON, con tope de tamaño y sin fiarse del
 * `Content-Type` (los Atajos de iOS no siempre lo ponen bien).
 *
 * Devuelve el objeto o la Response de error.
 */
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

/**
 * Convierte a número lo que llegue: los Atajos de iOS mandan los importes como
 * texto ("12,50") con la coma decimal española. Sin esto, un Atajo perfectamente
 * configurado fallaría con "Importe no válido".
 */
export function aNumero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const n = Number(v.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Texto de un campo del cuerpo (o undefined si no vino). */
export const aTexto = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : v === undefined || v === null ? undefined : String(v)
