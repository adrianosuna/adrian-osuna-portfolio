// Pantallas de arranque de iOS: qué tamaños se generan y con qué media query
// las pide cada dispositivo.
//
// iOS elige la imagen comparando `device-width`, `device-height` y
// `-webkit-device-pixel-ratio` con las de cada `<link>`. Si NINGUNA cuadra, no
// pinta ninguna y vuelve el fogonazo blanco, así que la lista cubre los iPhone
// y iPad en uso; el resto degrada al fondo del `theme_color`, que ya es oscuro.
//
// Los tamaños van en PÍXELES FÍSICOS (device-width × ratio), que es lo que la
// imagen tiene que medir. Sin `server-only`: los usan la ruta que las genera y
// el layout que las declara.

interface Splash {
  /** Tamaño físico de la imagen, 'anchoxalto'. */
  dim: string
  /** Ancho lógico del dispositivo (CSS px). */
  w: number
  /** Alto lógico del dispositivo (CSS px). */
  h: number
  /** Densidad de píxeles. */
  ratio: number
}

/**
 * Familias de pantalla cubiertas, en vertical. Una entrada por combinación
 * real de (ancho, alto, densidad); varios modelos comparten entrada.
 */
export const SPLASHES: Splash[] = [
  // iPhone 15/16 Pro Max, 14 Pro Max
  { dim: '1290x2796', w: 430, h: 932, ratio: 3 },
  // iPhone 16 Pro
  { dim: '1206x2622', w: 402, h: 874, ratio: 3 },
  // iPhone 15/16, 14 Pro
  { dim: '1179x2556', w: 393, h: 852, ratio: 3 },
  // iPhone 14 Plus, 13 Pro Max, 12 Pro Max
  { dim: '1284x2778', w: 428, h: 926, ratio: 3 },
  // iPhone 14, 13, 13 Pro, 12, 12 Pro
  { dim: '1170x2532', w: 390, h: 844, ratio: 3 },
  // iPhone 13 mini, 12 mini, 11 Pro, XS, X
  { dim: '1125x2436', w: 375, h: 812, ratio: 3 },
  // iPhone 11 Pro Max, XS Max
  { dim: '1242x2688', w: 414, h: 896, ratio: 3 },
  // iPhone 11, XR
  { dim: '828x1792', w: 414, h: 896, ratio: 2 },
  // iPhone 8 Plus, 7 Plus, 6s Plus
  { dim: '1242x2208', w: 414, h: 736, ratio: 3 },
  // iPhone SE (2ª/3ª), 8, 7, 6s
  { dim: '750x1334', w: 375, h: 667, ratio: 2 },
  // iPad Pro 12.9"
  { dim: '2048x2732', w: 1024, h: 1366, ratio: 2 },
  // iPad Pro 11" / Air
  { dim: '1668x2388', w: 834, h: 1194, ratio: 2 },
  // iPad 10.2" / mini
  { dim: '1536x2048', w: 768, h: 1024, ratio: 2 },
]

/** Tamaños permitidos en `/splash/[dim]` (allowlist de la ruta). */
export const DIMENSIONES_SPLASH: string[] = SPLASHES.map((s) => s.dim)

/**
 * Los `<link rel="apple-touch-startup-image">` para el layout, en el formato
 * que espera `metadata.icons.other` de Next.
 */
export const LINKS_SPLASH = SPLASHES.map((s) => ({
  rel: 'apple-touch-startup-image',
  url: `/splash/${s.dim}`,
  media: `(device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.ratio})`,
}))
