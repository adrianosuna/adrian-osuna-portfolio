// Tarjeta OpenGraph (1200×630) al compartir el portfolio. Minimalista:
// nombre con el punto teal de la marca, rol y la URL discreta al pie,
// centrado sobre el fondo oscuro de la paleta pública.
import { ImageResponse } from 'next/og'

export const alt = 'Adrián Osuna — Desarrollador Web Full-Stack'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// La fuente por defecto de next/og solo trae el peso regular (los fontWeight
// se ignoran): se carga Inter en el build. Si no hay red, se degrada a la
// fuente por defecto en vez de romper el build.
async function fuente(peso: 400 | 500 | 800): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`https://unpkg.com/@fontsource/inter@5.1.0/files/inter-latin-${peso}-normal.woff`)
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

export default async function OpengraphImage() {
  const pesos = [400, 500, 800] as const
  const cargadas = await Promise.all(pesos.map(fuente))
  const fonts = pesos.flatMap((peso, i) => {
    const data = cargadas[i]
    return data ? [{ name: 'Inter', data, weight: peso, style: 'normal' as const }] : []
  })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a1512',
          color: '#eafaf4',
          fontFamily: fonts.length ? 'Inter' : 'sans-serif',
        }}>
        <div
          style={{
            display: 'flex',
            fontSize: 108,
            fontWeight: 800,
            letterSpacing: '-4px',
            lineHeight: 1,
          }}>
          Adrián Osuna<span style={{ color: '#2dd4bf' }}>.</span>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 30,
            fontSize: 38,
            fontWeight: 500,
            letterSpacing: '0.5px',
            color: '#10b981',
          }}>
          Desarrollador Full-Stack
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 54,
            display: 'flex',
            fontSize: 24,
            fontWeight: 400,
            letterSpacing: '4px',
            color: '#5f7a71',
          }}>
          adrianosuna.com
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  )
}
