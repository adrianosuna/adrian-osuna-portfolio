// Endpoints de NextAuth, con un tope de peticiones por IP delante.
//
// Por qué: el OAuth de Google ya protege el login (no hay contraseña que
// probar), así que esto NO es contra la fuerza bruta. Es contra el machaque de
// `/api/auth/*`: cada intento hace trabajo real —consulta la allowlist y, si
// entra, escribe en `user_session` y `login_event`—, y eso es superficie
// pública que conviene no dejar sin freno.
//
// El límite es generoso (ver `LIMITE_LOGIN`): un login normal son dos o tres
// peticiones, así que 30 por minuto no lo nota nadie.
import type { NextRequest } from 'next/server'
import { handlers } from '@/auth'
import { avisarFrenado, claveIp, limitar, LIMITE_LOGIN } from '@/lib/rate-limit'

/** 429 con `Retry-After`, que es lo que el estándar manda contestar. */
function frenado(esperaS: number) {
  return new Response('Demasiadas peticiones', {
    status: 429,
    headers: { 'Retry-After': String(esperaS), 'Cache-Control': 'no-store' },
  })
}

// `NextRequest` y no `Request`: es lo que NextAuth espera recibir, y estrechar
// el tipo aquí evita un cast en la llamada.
const conLimite =
  (handler: (req: NextRequest) => Promise<Response> | Response) =>
  async (req: NextRequest): Promise<Response> => {
    const clave = claveIp(req, 'login')
    const res = limitar(clave, LIMITE_LOGIN)
    if (!res.ok) {
      avisarFrenado('auth', clave, res.esperaS)
      return frenado(res.esperaS)
    }
    return handler(req)
  }

export const GET = conLimite(handlers.GET)
export const POST = conLimite(handlers.POST)
