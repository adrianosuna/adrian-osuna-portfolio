// Tarjeta OpenGraph (1200×630) con el estilo de la landing: rejilla, halo,
// píldora con la ubicación, nombre grande, rol en verde y la marca al pie.
// Solo datos de la persona, sin empresa (petición de Adrián).
import { ImageResponse } from 'next/og'
import { MARCA_ALTO, MARCA_ANCHO, MARCA_D, MARCA_TINTA } from '@/lib/marca'
import { CONTENT, PROFILE } from '@/lib/landing/content'

export const alt = 'Adrián Osuna — Desarrollador Web Full-Stack'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// La fuente por defecto de next/og solo trae el peso regular: se carga Geist en el
// build (la misma que la web), y sin red se degrada en vez de romper.
async function fuente(peso: 400 | 500 | 600): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`https://unpkg.com/@fontsource/geist-sans@5.1.0/files/geist-sans-latin-${peso}-normal.woff`)
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

export default async function OpengraphImage() {
  const pesos = [400, 500, 600] as const
  const cargadas = await Promise.all(pesos.map(fuente))
  const fonts = pesos.flatMap((peso, i) => {
    const data = cargadas[i]
    return data ? [{ name: 'Geist', data, weight: peso, style: 'normal' as const }] : []
  })
  const rejilla = 'rgba(255,255,255,0.05)'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          background: '#0a1512',
          color: '#eafaf4',
          fontFamily: fonts.length ? 'Geist' : 'sans-serif',
        }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            backgroundImage: `linear-gradient(to right, ${rejilla} 1px, transparent 1px), linear-gradient(to bottom, ${rejilla} 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background: 'radial-gradient(ellipse 55% 60% at 50% 0%, rgba(16,185,129,0.28), rgba(10,21,18,0) 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background: 'linear-gradient(to bottom, rgba(10,21,18,0) 40%, rgba(10,21,18,0.9) 100%)',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: 12,
              padding: '10px 20px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              fontSize: 24,
              fontWeight: 500,
              color: '#c4d3cd',
            }}>
            <div style={{ display: 'flex', width: 10, height: 10, borderRadius: 999, background: '#10b981' }} />
            {CONTENT.footer.location}
          </div>
          <div style={{ display: 'flex', marginTop: 40, fontSize: 112, fontWeight: 600, letterSpacing: '-5px', lineHeight: 1 }}>
            {PROFILE.name}
          </div>
          <div style={{ display: 'flex', marginTop: 22, fontSize: 40, fontWeight: 500, color: '#10b981' }}>
            {CONTENT.hero.role}
          </div>
          <div style={{ display: 'flex', marginTop: 22, maxWidth: 920, fontSize: 28, lineHeight: 1.4, color: '#c4d3cd' }}>
            {CONTENT.footer.blurb}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            paddingTop: 28,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
          <svg width={92} height={(92 * MARCA_ALTO) / MARCA_ANCHO} viewBox={`0 0 ${MARCA_ANCHO} ${MARCA_ALTO}`}>
            <path d={MARCA_D} fill={MARCA_TINTA} fillRule="evenodd" />
          </svg>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 500, color: '#8ba398' }}>adrianosuna.com</div>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  )
}
