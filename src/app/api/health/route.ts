// GET /api/health — ¿está vivo el proceso? (liveness)
//
// PÚBLICO y a propósito mudo: responde 200 sin tocar la base de datos y sin
// contar nada del sistema. La versión, el commit o el uptime servirían para
// reconocer el despliegue, y también para reconocer la versión a la que atacar.
//
// Es lo que debe mirar el healthcheck de Docker para decidir si reiniciar el
// contenedor: si el proceso responde, Next está arriba. La base de datos se
// comprueba en `/api/ready`, que es otra pregunta (ver ahí por qué).
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
