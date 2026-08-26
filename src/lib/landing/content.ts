// Contenido de la landing pública. Fuente única de datos: perfil, experiencia,
// casos de estudio y textos en español. Enfoque: la página gira alrededor de
// la evidencia (proyectos como casos de estudio), no de la biografía.

export const PROFILE = {
  name: 'Adrián Osuna',
  email: 'adrianosunaalbala@gmail.com',
  linkedin: 'https://www.linkedin.com/in/adrián-osuna-albalá',
  github: 'https://github.com/adrianosuna',
}

// ─────────── Experiencia: fechas ───────────
// `end` ausente = puesto actual. El rango y la duración se calculan
// dinámicamente, de modo que "X años y Y meses" está siempre al día.

export type YM = { y: number; m: number }

export const TIMELINE = [
  {
    id: 'intarcon',
    name: 'INTARCON',
    logo: '/img/intarcon_logo.png',
    roles: [
      { start: { y: 2024, m: 1 } }, // Responsable de Desarrollo — actualidad
      { start: { y: 2021, m: 7 } }, // Full Stack Developer — actualidad
    ],
  },
  {
    id: 'kiconex',
    name: 'KICONEX',
    logo: '/img/kiconex_logo.png',
    roles: [{ start: { y: 2021, m: 3 }, end: { y: 2021, m: 6 } }],
  },
] as const satisfies ReadonlyArray<{
  id: string
  name: string
  logo: string
  roles: ReadonlyArray<{ start: YM; end?: YM }>
}>

export type TimelineCompany = (typeof TIMELINE)[number]

// ─────────── Helpers de fechas (rango y duración estilo LinkedIn) ───────────

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WORD = { present: 'Actualidad', year: ['año', 'años'], month: ['mes', 'meses'], and: 'y' } as const

const nowYM = (): YM => {
  const d = new Date()
  return { y: d.getFullYear(), m: d.getMonth() + 1 }
}
const diffMonths = (a: YM, b: YM) => (a.y - b.y) * 12 + (a.m - b.m) // meses de b → a
const monthName = (d: YM) => `${MONTHS[d.m - 1]} ${d.y}`

// "Enero 2024 — Actualidad"
export const periodLabel = (start: YM, end?: YM) =>
  `${monthName(start)} — ${end ? monthName(end) : WORD.present}`

// "5 años y 1 mes" (conteo inclusivo, como LinkedIn).
const durationLabel = (start: YM, end?: YM | null) => {
  const total = Math.max(diffMonths(end || nowYM(), start) + 1, 1)
  const y = Math.floor(total / 12)
  const m = total % 12
  const parts: string[] = []
  if (y) parts.push(`${y} ${y === 1 ? WORD.year[0] : WORD.year[1]}`)
  if (m) parts.push(`${m} ${m === 1 ? WORD.month[0] : WORD.month[1]}`)
  if (!parts.length) parts.push(`1 ${WORD.month[0]}`)
  return parts.join(` ${WORD.and} `)
}

// Años completos desde una fecha hasta hoy (para la franja de cifras: "5+").
export const yearsSince = (start: YM) => Math.floor(diffMonths(nowYM(), start) / 12)

// Duración total en una empresa: del primer puesto al último (o a la actualidad).
// Firma sobre YM genérico (no sobre los literales de TIMELINE): así admite
// cualquier rol, incluidos los de los tests.
export const companyDuration = (roles: ReadonlyArray<{ start: YM; end?: YM }>) => {
  const minStart = roles.map((r) => r.start).reduce((a, b) => (diffMonths(a, b) <= 0 ? a : b))
  const anyPresent = roles.some((r) => !('end' in r) || !r.end)
  const ends = roles.map((r) => ('end' in r ? r.end : undefined)).filter(Boolean) as YM[]
  const end = anyPresent || !ends.length ? null : ends.reduce((a, b) => (diffMonths(a, b) >= 0 ? a : b))
  return durationLabel(minStart, end)
}

// ─────────── Textos de la landing ───────────

export interface CaseStudy {
  title: string
  tag: string
  image: string | null
  /** Enlace vivo del proyecto (null si es interno). */
  url: string | null
  /** Texto del enlace vivo ("Probarla en vivo"). */
  urlLabel?: string
  /** Recorta la captura desde arriba en vez de centrada (capturas con cabecera). */
  imageTop?: boolean
  /** Repositorio público del proyecto (enlace "Ver el código"). */
  repo?: string
  scratch: boolean
  stack: string[]
  /** El reto / contexto del que partía el proyecto. */
  context: string
  /** Qué construí yo (papel + solución + stack en prosa). */
  built: string
  /** El resultado / estado actual. */
  result: string
}

export interface Content {
  nav: { projects: string; about: string; experience: string; contact: string; dashboard: string }
  hero: { hi: string; role: string; tagline: string; location: string; ctaWork: string; ctaContact: string }
  stats: { experience: string; platforms: string; firstDev: string; leading: string }
  projectsTitle: string
  caseLabels: { context: string; built: string; result: string }
  projects: CaseStudy[]
  about: { title: string; text: string; facts: Array<{ label: string; value: string }> }
  experienceTitle: string
  experience: Array<{
    company: string
    employment: string
    place: string
    roles: Array<{ role: string; points: string[]; stack: string[] }>
  }>
  scratch: string
  contact: { title: string; headline: string; text: string }
  footer: { blurb: string; navTitle: string; contactTitle: string; location: string; rights: string }
  a11y: {
    skip: string
    home: string
    openMenu: string
    closeMenu: string
  }
}

export const CONTENT: Content = {
  nav: { projects: 'Proyectos', about: 'Sobre mí', experience: 'Experiencia', contact: 'Contacto', dashboard: 'Dashboard' },
  hero: {
    hi: 'Hola, soy',
    role: 'Desarrollador Full-Stack',
    tagline: 'Full-stack de la base de datos a la interfaz. Entré como primer desarrollador de INTARCON y hoy lidero su equipo de software.',
    location: 'Moriles, Andalucía · INTARCON (Lucena)',
    ctaWork: 'Ver mi trabajo',
    ctaContact: 'Contactar',
  },
  stats: {
    experience: 'Años construyendo software',
    platforms: 'Plataformas en producción',
    firstDev: 'Desarrollador de INTARCON',
    leading: 'Años liderando el equipo',
  },
  projectsTitle: 'Proyectos',
  caseLabels: { context: 'El reto', built: 'Qué construí', result: 'El resultado' },
  projects: [
    {
      title: 'Client360',
      tag: 'INTARCON',
      image: '/img/projects/client360.png',
      url: 'https://client360.intarcon.com/',
      urlLabel: 'Probarla en vivo',
      imageTop: true,
      scratch: true,
      stack: ['React', 'Node.js', 'Python', 'MySQL', 'Redis', 'Socket.IO'],
      context:
        'Dimensionar una instalación frigorífica exigía conocimiento de ingeniería y herramientas internas: cada cálculo dependía del equipo técnico.',
      built:
        'Una aplicación web colaborativa donde el cliente dimensiona cámaras y depósitos, calcula cargas térmicas y procesos, selecciona equipos y unidades de refrigeración, dimensiona redes de tuberías y consulta propiedades termodinámicas — compartiendo proyecto con su equipo en tiempo real. Frontend en React, API en Node.js, motor de cálculo en Python, y Redis con Socket.IO para la colaboración en vivo.',
      result:
        'En producción y abierta a cualquiera: la herramienta con la que los clientes de INTARCON dimensionan sus instalaciones desde el navegador, sin depender del equipo técnico para cada cálculo.',
    },
    {
      title: 'IntarLAB',
      tag: 'INTARCON',
      image: '/img/projects/intarlab.png',
      url: null,
      scratch: true,
      stack: ['Node.js', 'React', 'InfluxDB', 'MySQL', 'Hardware'],
      context:
        'Los ensayos de equipos de refrigeración generaban datos y documentación difíciles de trazar y de gestionar a mano.',
      built:
        'La plataforma integral del laboratorio, integrando software y hardware: adquisición de datos de sensores en series temporales, control de los ensayos, trazabilidad documental completa e historial técnico de cada equipo. Fui el primer desarrollador del equipo: monté las bases tecnológicas y metodológicas sobre las que hoy trabaja el departamento.',
      result: 'En producción: la herramienta de trabajo diaria del laboratorio de INTARCON.',
    },
    {
      title: 'Portfolio & Dashboard',
      tag: 'Personal',
      image: '/img/projects/portfolio.png',
      url: null,
      repo: 'https://github.com/adrianosuna/adrian-osuna-portfolio',
      scratch: true,
      stack: ['Next.js', 'TypeScript', 'Prisma', 'MySQL', 'Tailwind CSS'],
      context: 'Un portfolio dice; una aplicación demuestra. Quería que mi web fuera las dos cosas.',
      built:
        'Lo que estás viendo es la parte pública. Detrás hay un dashboard real: acceso con Google por lista de invitados y roles aplicados en vivo, un módulo de finanzas personales con gráficas SVG dibujadas a mano (sin librerías) y gestión de usuarios. Next.js, TypeScript, Prisma y MySQL, desplegado con Docker.',
      result: 'Este sitio es su propia demo.',
    },
  ],
  about: {
    title: 'Sobre mí',
    text: 'Empecé como el primer desarrollador de INTARCON y hoy lidero su equipo de software. Me gusta el código que toca el mundo real: sensores, máquinas y herramientas que otra gente usa a diario para trabajar. Fuera del teclado: viajar, conocer nuevas culturas y deporte al aire libre.',
    facts: [
      { label: 'Rol actual', value: 'Responsable de Desarrollo · INTARCON' },
      { label: 'Stack diario', value: 'React · Node.js · TypeScript · MySQL' },
      { label: 'Formación', value: 'Grado Superior en DAW' },
      { label: 'Ubicación', value: 'Moriles, Andalucía' },
    ],
  },
  experienceTitle: 'Experiencia',
  experience: [
    {
      company: 'intarcon', employment: 'Jornada completa', place: 'Lucena · Híbrido',
      roles: [
        {
          role: 'Responsable de Desarrollo de Software',
          points: [
            'Planificación, ejecución y supervisión de todo el ciclo de desarrollo, del concepto a la entrega.',
            'Metodologías ágiles y coordinación entre negocio, clientes y equipo.',
          ],
          stack: ['Node.js', 'React'],
        },
        {
          role: 'Full Stack Developer',
          points: [
            'Desarrollo desde cero de IntarLAB y Client360 — el detalle, en los casos de estudio de arriba.',
          ],
          stack: ['Back-End', 'Bases de datos', 'React', 'Node.js'],
        },
      ],
    },
    {
      company: 'kiconex', employment: 'Contrato de prácticas', place: 'Lucena · Presencial',
      roles: [
        {
          role: 'Desarrollador web',
          points: [
            'Prácticas formativas en el equipo de desarrollo web: Front-End y resolución de errores.',
          ],
          stack: ['PHP', 'JavaScript'],
        },
      ],
    },
  ],
  scratch: 'Desde cero',
  contact: {
    title: 'Contacto',
    headline: '¿Construimos algo juntos?',
    text: 'Si tienes un proyecto en mente, buscas a alguien que lo lidere o simplemente quieres hablar de software, escríbeme: respondo en menos de 24 horas.',
  },
  footer: {
    blurb: 'Aplicaciones web eficientes y escalables, del backend a la interfaz.',
    navTitle: 'Navegación',
    contactTitle: 'Contacto',
    location: 'Moriles, Andalucía · España',
    rights: 'Todos los derechos reservados.',
  },
  a11y: {
    skip: 'Saltar al contenido',
    // Debe CONTENER el texto visible del logo ("AO.") — regla WCAG 2.5.3
    // (label in name): el nombre accesible debe incluir la etiqueta visible.
    home: 'AO. Ir al inicio',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
  },
}
