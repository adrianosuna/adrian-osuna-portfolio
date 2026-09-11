// GET /api/health: liveness. Público y mudo (200 sin tocar la BD ni contar nada);
// es lo que mira el healthcheck de Docker. La BD se comprueba en /api/ready.
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
