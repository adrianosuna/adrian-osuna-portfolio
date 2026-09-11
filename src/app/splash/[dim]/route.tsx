// Pantallas de arranque de la app instalada en iOS, una por tamaño de pantalla,
// generadas en runtime. Los tamaños válidos están en una allowlist.
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

  // La marca ocupa el 36 % del lado corto: se lee igual en un iPhone SE y en un
  // iPad Pro. Va por ancho porque es un trazo, no texto.
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
