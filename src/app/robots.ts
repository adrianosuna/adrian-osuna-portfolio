// robots.txt: la landing es pública; el dashboard, el login y la API no se
// indexan. Los crawlers de IA (buscadores generativos y entrenamiento) están
// permitidos EXPLÍCITAMENTE: interesa aparecer en las respuestas de ChatGPT,
// Perplexity, Claude, Gemini... — la misma política que el resto de agentes,
// declarada agente a agente para que ninguno se retraiga por ambigüedad.
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Con barra o ancla `$` para no bloquear por prefijo rutas legítimas
// como /apple-icon.png (Google pide que los iconos sean rastreables).
const PRIVADO = ['/app/', '/app$', '/api/', '/login']

// Agentes de IA conocidos: búsqueda generativa, asistentes que navegan por
// petición del usuario y rastreadores de entrenamiento.
const AGENTES_IA = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', // OpenAI
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', // Anthropic
  'PerplexityBot', 'Perplexity-User', // Perplexity
  'Google-Extended', // Gemini (los AI Overviews usan el Googlebot normal)
  'Applebot', 'Applebot-Extended', // Apple Intelligence
  'Amazonbot', // Alexa
  'meta-externalagent', // Meta IA
  'DuckAssistBot', // DuckDuckGo
  'MistralAI-User', // Mistral (Le Chat)
  'CCBot', // Common Crawl (base de muchos datasets)
  'Bytespider', // ByteDance
  'cohere-ai', // Cohere
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVADO,
      },
      {
        userAgent: AGENTES_IA,
        allow: '/',
        disallow: PRIVADO,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
