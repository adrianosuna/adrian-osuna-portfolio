// URL base del sitio: dominio real en producción (NEXT_PUBLIC_SITE_URL) o el
// localhost de desarrollo. Fuente única para metadata, robots y sitemap.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:9444'

// Olvidar la variable en producción es silencioso (el build no falla) y deja
// canonical, OG, sitemap y JSON-LD apuntando a localhost: al menos, avisar.
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SITE_URL) {
  console.warn('⚠ NEXT_PUBLIC_SITE_URL no está definida: la metadata apuntará a localhost')
}
