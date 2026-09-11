// Pantallas de arranque (splash) de la app instalada en iPhone/iPad.
//
// iOS no las genera solo: exige una imagen POR TAMAÑO de pantalla, declarada
// con `<link rel="apple-touch-startup-image" media="...">`. Sin ellas, al abrir
// la app desde la pantalla de inicio se ve un fondo blanco unos instantes —
// justo el fogonazo que delata que "esto es una web".
//
// Se generan en runtime con ImageResponse (como el apple-icon) en vez de
// commitear 15 PNG: la marca centrada sobre el fondo oscuro, al tamaño que
// pida la URL (`/splash/1179x2556`). Los tamaños válidos están en
// una allowlist: así una URL inventada no puede pedir una imagen de 20000px.
import { ImageResponse } from 'next/og'
import { MARCA_ALTO, MARCA_ANCHO, MARCA_D, MARCA_FONDO, MARCA_TINTA } from '@/lib/marca'
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

  // La marca ocupa el 36 % del lado corto: se lee igual en un iPhone SE y en
  // un iPad Pro sin recalcular nada. Va por ANCHO y no por tamaño de fuente
  // porque ya no es texto — es el trazo de `lib/marca.ts`.
  const lado = Math.min(width, height)
  const ancho = Math.round(lado * 0.36)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: MARCA_FONDO,
        }}>
        <svg
          width={ancho}
          height={(ancho * MARCA_ALTO) / MARCA_ANCHO}
          viewBox={`0 0 ${MARCA_ANCHO} ${MARCA_ALTO}`}>
          <path d={MARCA_D} fill={MARCA_TINTA} fillRule="evenodd" />
        </svg>
      </div>
    ),
    { width, height },
  )
}
