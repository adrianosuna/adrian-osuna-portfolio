// llms.txt: resumen del sitio en Markdown para modelos de lenguaje y buscadores
// de IA (https://llmstxt.org). Se genera desde src/lib/landing/content.ts — la
// fuente única del contenido — así que nunca se desincroniza de la web. Al ser
// el sitio de una sola página, incluye el contenido completo directamente.
import { CONTENT, PROFILE, TIMELINE, periodLabel } from '@/lib/landing/content'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-static'

export function GET() {
  const c = CONTENT
  const intarcon = TIMELINE.find((t) => t.id === 'intarcon')!
  const kiconex = TIMELINE.find((t) => t.id === 'kiconex')!

  const proyectos = c.projects
    .map((p) => {
      const enlaces = [
        p.url ? `[Demo en vivo](${p.url})` : null,
        p.repo ? `[Código](${p.repo})` : null,
      ].filter(Boolean)
      return [
        `### ${p.title} (${p.tag})`,
        '',
        `- **${c.caseLabels.context}**: ${p.context}`,
        `- **${c.caseLabels.built}**: ${p.built}`,
        `- **${c.caseLabels.result}**: ${p.result}`,
        `- **Stack**: ${p.stack.join(', ')}`,
        ...(enlaces.length ? [`- **Enlaces**: ${enlaces.join(' · ')}`] : []),
      ].join('\n')
    })
    .join('\n\n')

  // Los dos roles de INTARCON siguen vigentes (sin `end` en TIMELINE).
  const rolesIntarcon = c.experience[0].roles
    .map((r, i) => `  - ${r.role} (${periodLabel(intarcon.roles[i].start)}): ${r.points.join(' ')}`)
    .join('\n')
  const rolKiconex = c.experience[1].roles[0]

  const md = `# ${PROFILE.name} — ${c.hero.role}

> ${c.hero.tagline} Portfolio personal en español con casos de estudio reales
> (reto → qué construí → resultado). Sitio: ${SITE_URL}

Datos clave:

- **Rol actual**: ${c.about.facts[0].value}
- **Stack diario**: ${c.about.facts[1].value}
- **Formación**: ${c.about.facts[2].value}
- **Ubicación**: ${c.about.facts[3].value} (España)
- **Sobre mí**: ${c.about.text}

## Proyectos (casos de estudio)

${proyectos}

## Experiencia

- **INTARCON** (${c.experience[0].place}, ${c.experience[0].employment}):
${rolesIntarcon}
- **KICONEX** (${c.experience[1].place}, ${c.experience[1].employment}):
  - ${rolKiconex.role} (${periodLabel(kiconex.roles[0].start, kiconex.roles[0].end)}): ${rolKiconex.points.join(' ')}

## Contacto

- **Email**: ${PROFILE.email} (${c.contact.text})
- **LinkedIn**: ${PROFILE.linkedin}
- **GitHub**: ${PROFILE.github}
- **Web**: ${SITE_URL}
`

  return new Response(md, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
