// Endpoints de NextAuth con tope de peticiones por IP. No es contra fuerza bruta
// (OAuth), sino contra el machaque de /api/auth/*, que consulta y escribe en BD.
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
