import type { Metadata } from 'next'
import { Landing } from '@/components/landing/landing'

// Canonical y og:url solo aquí (no en el layout raíz, donde se heredarían en
// /login y /app). Nota: `openGraph` no se fusiona en profundidad con el del
// layout, así que se redeclara completo.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Adrián Osuna — Desarrollador Web',
    description:
      'Portfolio de Adrián Osuna, desarrollador web full-stack especializado en React y Node.js.',
    url: '/',
    siteName: 'Adrián Osuna',
    locale: 'es_ES',
    type: 'website',
  },
}

export default function Home() {
  return <Landing />
}
