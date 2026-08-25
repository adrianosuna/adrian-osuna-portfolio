// robots.txt: la landing es pública; el dashboard, el login y la API no se indexan.
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Con barra o ancla `$` para no bloquear por prefijo rutas legítimas
      // como /apple-icon.png (Google pide que los iconos sean rastreables).
      disallow: ['/app/', '/app$', '/api/', '/login'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
