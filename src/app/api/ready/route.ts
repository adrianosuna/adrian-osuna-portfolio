// GET /api/ready — ¿puede atender peticiones de verdad? (readiness)
//
// Hace un `SELECT 1` con tope de tiempo: 200 si la BD contesta, **503 si no**.
// Es lo que mira un balanceador para dejar de mandarle tráfico a un contenedor
// que está arriba pero no puede servir nada.
//
// ⚠ Por qué NO es el healthcheck de Docker: un healthcheck que falla reinicia
// el contenedor, y reiniciar `web` porque la BD tarda en arrancar es exactamente
// el bucle que no se quiere. Vivo (`/api/health`) y listo (`/api/ready`) son dos
// preguntas distintas, y mezclarlas convierte un problema de la BD en una caída
// del web.
//
// PÚBLICO, y por eso solo dice sí o no: ni el error de la BD, ni su versión, ni
// cuánto tardó. El detalle está en la pestaña Servidor del Panel, con sesión.
import { prisma } from '@/lib/prisma'
import { log } from '@/lib/log'

export const dynamic = 'force-dynamic'

/** Un `SELECT 1` que tarde más que esto es tan malo como uno que falla. */
const TOPE_MS = 3000

export async function GET() {
  const cabeceras = { 'Cache-Control': 'no-store' }
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TOPE_MS)),
    ])
    return Response.json({ ok: true }, { headers: cabeceras })
  } catch (e) {
    log.warn('ready', 'la base de datos no responde', { error: e })
    return Response.json({ ok: false }, { status: 503, headers: cabeceras })
  }
}
