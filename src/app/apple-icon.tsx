// Icono para iOS (180×180, fondo sólido): la marca sobre el fondo oscuro.
//
// Sin esquinas redondeadas a propósito: iOS recorta el apple-touch-icon él
// mismo, y redondearlo aquí dejaría un borde oscuro dentro del recorte.
import { ImageResponse } from 'next/og'
import { MARCA_ALTO, MARCA_ANCHO, MARCA_D, MARCA_FONDO, MARCA_TINTA } from '@/lib/marca'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  // 54 de cada 64: aquí SÍ hay placa oscura debajo, así que la marca deja
  // margen. El favicon del navegador va suelto sobre la pestaña y por eso usa
  // otro encuadre, más aprovechado (60/64, en `scripts/generar-marca.mjs`).
  const ancho = Math.round((size.width * 54) / 64)

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
          {/* fill y fill-rule van en el <path>, no heredados del <svg>: satori
              no propaga esos atributos, y sin `evenodd` la A sale maciza. */}
          <path d={MARCA_D} fill={MARCA_TINTA} fillRule="evenodd" />
        </svg>
      </div>
    ),
    size,
  )
}
