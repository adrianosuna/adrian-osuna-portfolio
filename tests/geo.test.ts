// Superficies para buscadores (clásicos y de IA): el contrato de robots.txt
// (agentes de IA bienvenidos, zona privada vetada) y de /llms.txt (el resumen
// del sitio se genera desde content.ts y debe contener lo esencial).
import { describe, expect, it } from 'vitest'
import robots from '@/app/robots'
import { GET as llms } from '@/app/llms.txt/route'
import { CONTENT, PROFILE } from '@/lib/landing/content'

describe('robots.txt', () => {
  const reglas = robots().rules as Array<{ userAgent: string | string[]; allow?: unknown; disallow?: string[] }>

  it('todas las reglas vetan el dashboard, la API y el login', () => {
    for (const regla of reglas) {
      expect(regla.disallow).toEqual(expect.arrayContaining(['/app/', '/app$', '/api/', '/login']))
    }
  })

  it('da la bienvenida explícita a los agentes de IA relevantes', () => {
    const agentes = reglas.flatMap((r) => r.userAgent)
    for (const bot of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot']) {
      expect(agentes).toContain(bot)
    }
  })

  it('no bloquea por prefijo rutas legítimas como /apple-icon', () => {
    const vetos = reglas.flatMap((r) => r.disallow ?? [])
    expect(vetos).not.toContain('/app') // sin barra ni ancla bloquearía /apple-icon
  })
})

describe('/llms.txt', () => {
  it('contiene la identidad, TODOS los casos de estudio completos y el contacto', async () => {
    const md = await llms().text()
    expect(md).toContain(`# ${PROFILE.name}`)
    expect(md).toContain(CONTENT.hero.tagline)
    for (const p of CONTENT.projects) {
      expect(md).toContain(`### ${p.title}`)
      expect(md).toContain(p.context)
      expect(md).toContain(p.built)
      expect(md).toContain(p.result)
    }
    expect(md).toContain(PROFILE.email)
    expect(md).toContain(PROFILE.github)
  })

  it('es texto plano en UTF-8 (no HTML)', () => {
    const res = llms()
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
  })
})
