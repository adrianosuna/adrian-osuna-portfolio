// Icono para iOS (180×180, fondo sólido): monograma AO. generado en runtime.
import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: '-4px',
        }}>
        AO
        <span style={{ color: '#2dd4bf' }}>.</span>
      </div>
    ),
    size,
  )
}
