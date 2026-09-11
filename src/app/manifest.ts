// Manifiesto PWA (/manifest.webmanifest). Safari en iOS ignora estos iconos y usa
// el apple-touch-icon; el manifest da la instalación en Android y escritorio.
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Adrián Osuna',
    short_name: 'AO',
    description: 'Portfolio y panel de gestión personal.',
    // Abre directo al dashboard (si no hay sesión, él mismo lleva a /login).
    start_url: '/app',
    display: 'standalone',
    background_color: '#0a1512',
    theme_color: '#0a1512',
    lang: 'es',
    icons: [
      // SVG escalable (Android moderno y escritorio): sirve para cualquier tamaño.
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      // PNG de respaldo (el apple-icon, 180×180) para clientes sin soporte SVG.
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
    // Accesos directos del icono. Safari en iOS no los implementa; se declaran porque
    // valen en Android y escritorio y no cuestan nada.
    shortcuts: [
      {
        name: 'Apuntar un gasto',
        short_name: 'Nuevo gasto',
        description: 'Abre el alta rápida de movimiento',
        // `?nuevo=gasto` lo entiende el inicio y abre el modal al entrar.
        url: '/app?nuevo=gasto',
      },
      {
        name: 'Gastos del mes',
        short_name: 'Gastos',
        description: 'Los movimientos de este mes',
        url: '/app/finance?s=gastos',
      },
      {
        name: 'Nueva nota',
        short_name: 'Nota',
        description: 'Abre el editor de notas en blanco',
        url: '/app/panel?tab=notas&nueva=1',
      },
    ],
  }
}
