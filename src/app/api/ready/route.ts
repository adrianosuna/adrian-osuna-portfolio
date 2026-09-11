// GET /api/ready: readiness. SELECT 1 con tope; 503 si la BD no contesta. No es el
// healthcheck de Docker: reiniciar web porque la BD tarda es el bucle a evitar.
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
