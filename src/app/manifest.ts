// Manifiesto de la app instalable (PWA). Next lo sirve en /manifest.webmanifest
// y añade solo el <link rel="manifest">. El sitio se puede "añadir a la pantalla
// de inicio" y abrir a pantalla completa, entrando directo al dashboard.
//
// En iPhone/iPad, Safari IGNORA los iconos de aquí y usa el apple-touch-icon
// (apple-icon.tsx) más los metadatos `appleWebApp` del layout raíz; el manifest
// da la experiencia instalable en Android y escritorio. El monograma AO. y los
// colores son los mismos de la marca (icon.svg / apple-icon.tsx).
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Adrián Osuna',
    short_name: 'AO.',
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
    // Accesos directos del icono (menú contextual al mantenerlo pulsado).
    //
    // ⚠ Safari en iOS/iPadOS NO los implementa: en el iPhone el icono no abre
    // menú. Se declaran igual porque son gratis, valen en Android y en
    // escritorio (Chrome/Edge los ponen en la barra de tareas), y el día que
    // Safari los soporte ya están. La alternativa en iPhone es añadir a la
    // pantalla de inicio la URL concreta, que funciona desde hoy.
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
