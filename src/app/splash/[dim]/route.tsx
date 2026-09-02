// Pantallas de arranque (splash) de la app instalada en iPhone/iPad.
//
// iOS no las genera solo: exige una imagen POR TAMAÑO de pantalla, declarada
// con `<link rel="apple-touch-startup-image" media="...">`. Sin ellas, al abrir
// la app desde la pantalla de inicio se ve un fondo blanco unos instantes —
// justo el fogonazo que delata que "esto es una web".
//
// Se generan en runtime con ImageResponse (como el apple-icon) en vez de
// commitear 15 PNG: el monograma AO. centrado sobre el fondo de la marca, al
// tamaño que pida la URL (`/splash/1179x2556`). Los tamaños válidos están en
// una allowlist: así una URL inventada no puede pedir una imagen de 20000px.
import { ImageResponse } from 'next/og'
import { DIMENSIONES_SPLASH } from '@/lib/splash'

export const contentType = 'image/png'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dim: string }> },
) {
  const { dim } = await params
  // Allowlist: solo los tamaños que se declaran en el layout.
  if (!DIMENSIONES_SPLASH.includes(dim)) {
    return new Response('Tamaño no soportado', { status: 404 })
  }
  const [width, height] = dim.split('x').map(Number)

  // El monograma ocupa ~22% del lado corto: se lee igual en un iPhone SE y en
  // un iPad Pro sin recalcular nada.
  const lado = Math.min(width, height)
  const fuente = Math.round(lado * 0.22)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a1512',
          color: '#eafaf4',
          fontSize: fuente,
          fontWeight: 800,
          letterSpacing: `${-fuente * 0.04}px`,
        }}>
        AO
        <span style={{ color: '#2dd4bf' }}>.</span>
      </div>
    ),
    { width, height },
  )
}
