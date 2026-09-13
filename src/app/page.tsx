import type { Metadata } from 'next'
import { Landing } from '@/components/landing/landing'

// Canonical y og:url solo aquí (en el layout raíz se heredarían en /login y
// /app). `openGraph` no se fusiona en profundidad: se redeclara completo.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Adrián Osuna — Desarrollador Web',
    description:
      'Portfolio de Adrián Osuna, desarrollador web Full-Stack especializado en React y Node.js.',
    url: '/',
    siteName: 'Adrián Osuna',
    locale: 'es_ES',
    type: 'website',
  },
}

export default function Home() {
  return <Landing />
}
