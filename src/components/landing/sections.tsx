// Secciones de la landing, renderizadas en el servidor. Reciben el contenido `t`
// resuelto; la página gira alrededor de los casos de estudio. Las únicas islas
// cliente son `TarjetaCaso`, `CompanyLogo`, `Contador` y `Reveal`.
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Database, FileText, Mail, MapPin, Search, Server } from 'lucide-react'
// lucide retiró los iconos de marcas; GitHub y LinkedIn vienen de react-icons.
import { FaGithub, FaLinkedin } from 'react-icons/fa6'
import { cn } from '@/lib/utils'
import { Logotipo } from '@/components/ui/logotipo'
import { Reveal } from '@/components/landing/reveal'
import { Contador } from '@/components/landing/contador'
import { TarjetaCaso } from '@/components/landing/tarjeta-caso'
import { CompanyLogo } from '@/components/landing/company-logo'
import {
  btnPrimario, btnSecundario, chip, contenedor, etiqueta, seccion, tarjeta,
} from '@/components/landing/estilos'
import {
  PROFILE, TIMELINE, companyDuration, periodLabel, yearsSince,
  type CaseStudy, type Content,
} from '@/lib/landing/content'

// Cabecera de sección: píldora con el nombre, titular grande y entradilla.
function SectionHeader({
  eyebrow, headline, intro, center,
}: { eyebrow: string; headline: string; intro?: string; center?: boolean }) {
  return (
    <Reveal as="header" className={cn('mb-12 max-w-2xl', center && 'mx-auto text-center')}>
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs font-medium text-muted-foreground">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
        {eyebrow}
      </span>
      <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl lg:text-[44px] lg:leading-[1.1]">
        {headline}
      </h2>
      {intro && <p className="mt-4 text-base leading-relaxed text-body sm:text-lg">{intro}</p>}
    </Reveal>
  )
}

export function Hero({ t }: { t: Content }) {
  const socials = [
    { href: PROFILE.github, label: 'GitHub', Icon: FaGithub, ga: 'clic_github' },
    { href: PROFILE.linkedin, label: 'LinkedIn', Icon: FaLinkedin, ga: 'clic_linkedin' },
    { href: `mailto:${PROFILE.email}`, label: 'Correo', Icon: Mail, ga: 'clic_email' },
  ]
  return (
    <section className="relative overflow-hidden">
      {/* Fondo: rejilla que se desvanece hacia abajo y halo esmeralda desde arriba. */}
      <div aria-hidden="true" className="pf-grid absolute inset-0 mask-[radial-gradient(ellipse_70%_60%_at_50%_0%,#000_20%,transparent_75%)]" />
      <div aria-hidden="true" className="pf-hero-glow" />

      <div className={cn(contenedor, 'relative pb-16 pt-32 text-center sm:pt-40')}>
        <Reveal inmediata>
          <a
            href="#sobre-mi"
            className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/4 py-1 pl-1 pr-3.5 text-[13px] text-body transition-colors hover:border-white/25 hover:text-foreground sm:text-sm">
            <Image
              src="/img/adrian.webp"
              alt=""
              width={26}
              height={26}
              priority
              className="size-6.5 rounded-full object-cover object-top"
            />
            {t.hero.badge}
            <ArrowRight className="size-3.5 text-muted-foreground" />
          </a>
        </Reveal>
        <Reveal inmediata delay={80}>
          <h1 className="mx-auto mt-7 max-w-4xl text-[clamp(44px,8vw,92px)] font-semibold leading-none tracking-[-0.04em] text-foreground">
            {PROFILE.name}
          </h1>
        </Reveal>
        <Reveal inmediata as="p" delay={140} className="mt-4 text-lg font-medium text-primary sm:text-xl">
          {t.hero.role}
        </Reveal>
        <Reveal inmediata as="p" delay={200} className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-body sm:text-lg">
          {t.hero.tagline}
        </Reveal>
        {/* La acción principal lleva a la evidencia (los proyectos). */}
        <Reveal inmediata delay={260} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a className={btnPrimario} href="#proyectos">
            {t.hero.ctaWork}
            <ArrowRight className="size-4" />
          </a>
          <a className={btnSecundario} href="#contacto" data-ga="clic_contactar">
            {t.hero.ctaContact}
          </a>
        </Reveal>
        <Reveal
          inmediata
          delay={320}
          className="mt-8 flex flex-col items-center gap-4 text-sm text-muted-foreground sm:flex-row sm:justify-center sm:gap-5">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            {t.hero.location}
          </span>
          <span className="flex items-center gap-2">
            {socials.map(({ href, label, Icon, ga }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noreferrer' : undefined}
                aria-label={label}
                data-ga={ga}
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/3 text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground">
                <Icon className="size-4" />
              </a>
            ))}
          </span>
        </Reveal>
      </div>
    </section>
  )
}

// Cifras en tres tarjetas bajo el hero. Los años se calculan desde las fechas
// reales. Entrada inmediata: en móvil asoman en el primer pantallazo y con el
// observer eran el LCP a 3,3 s.
export function Stats({ t }: { t: Content }) {
  const items = [
    { numero: yearsSince({ y: 2021, m: 3 }), sufijo: '+', label: t.stats.experience },
    { numero: 2, sufijo: '', label: t.stats.platforms },
    { numero: yearsSince({ y: 2024, m: 1 }), sufijo: '+', label: t.stats.leading },
  ]
  return (
    <section className={contenedor}>
      <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
        {items.map((s, i) => (
          <Reveal key={s.label} inmediata delay={400 + i * 60} className={cn(tarjeta, 'flex flex-col p-3.5 sm:p-6')}>
            <dt className="order-2 mt-1.5 text-xs text-muted-foreground sm:mt-2 sm:text-sm">{s.label}</dt>
            <dd className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
              <Contador numero={s.numero} sufijo={s.sufijo} />
            </dd>
          </Reveal>
        ))}
      </dl>
    </section>
  )
}

// Marco de navegador para las capturas y las maquetas: barra con tres puntos y ventana 16:9.
function MarcoNavegador({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-white/10 bg-[#0d1a16] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.85)]', className)}>
      <div aria-hidden="true" className="flex items-center gap-1.5 border-b border-white/8 bg-white/3 px-3 py-2">
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="mx-auto h-3.5 w-28 rounded-md bg-white/6" />
      </div>
      <div className="relative aspect-video">{children}</div>
    </div>
  )
}

// Maqueta de interfaz para un caso sin captura: cabecera, tres baldosas con
// los módulos del proyecto y un panel dibujado (sin cifras, solo forma).
function Maqueta({ variante, modulos }: { variante: 'series' | 'panel'; modulos: string[] }) {
  const baldosa = 'overflow-hidden rounded-md border border-white/8 bg-white/3'
  const barras = [42, 68, 55, 80, 62, 90, 74, 58]
  return (
    <div aria-hidden="true" className="absolute inset-0 grid grid-rows-[auto_auto_minmax(0,1fr)] gap-1.5 bg-[#0b1714] p-2.5 text-[9px] leading-none text-muted-foreground">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" />
          <span className="h-2 w-20 rounded bg-white/15" />
        </span>
        <span className="h-3 w-12 rounded-full bg-primary/70" />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[0.7, 0.45, 0.85].map((f, i) => (
          <div key={i} className={cn(baldosa, 'px-2 py-1.5')}>
            <span className="block truncate">{modulos[i]}</span>
            <span className="mt-1 block h-2 rounded bg-foreground/70" style={{ width: `${f * 100}%` }} />
          </div>
        ))}
      </div>
      {variante === 'series' ? (
        <div className={cn(baldosa, 'relative')}>
          {/* Un SVG posicionado no se estira con los insets: el tamaño va explícito. */}
          <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)]">
            {[25, 50, 75].map((y) => (
              <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="rgba(255,255,255,0.06)" vectorEffect="non-scaling-stroke" />
            ))}
            <path d="M0 78 L30 70 L60 74 L90 52 L120 58 L150 36 L180 44 L210 22 L240 32 L270 14 L300 20 V100 H0 Z" fill="var(--primary)" fillOpacity="0.12" />
            <path d="M0 78 L30 70 L60 74 L90 52 L120 58 L150 36 L180 44 L210 22 L240 32 L270 14 L300 20" fill="none" stroke="var(--primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <path d="M0 88 L30 84 L60 86 L90 76 L120 80 L150 66 L180 70 L210 58 L240 62 L270 50 L300 54" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      ) : (
        <div className="grid min-h-0 grid-cols-[3fr_2fr] gap-1.5">
          <div className={cn(baldosa, 'flex items-end gap-1 p-2')}>
            {barras.map((h, i) => (
              <span key={i} className={cn('flex-1 rounded-sm', i === 5 ? 'bg-primary' : 'bg-primary/40')} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className={cn(baldosa, 'flex items-center justify-center p-2')}>
            <svg viewBox="0 0 40 40" className="h-full max-h-16 w-auto">
              <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle cx="20" cy="20" r="15" fill="none" stroke="var(--primary)" strokeWidth="6" strokeDasharray="58 94" transform="rotate(-90 20 20)" />
              <circle cx="20" cy="20" r="15" fill="none" stroke="var(--viajes)" strokeWidth="6" strokeDasharray="22 94" strokeDashoffset="-58" transform="rotate(-90 20 20)" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}

// La ventana de un caso: la captura real si la hay; si no, la maqueta. Se pinta
// en el servidor y viaja a la tarjeta como nodo.
function VentanaCaso({ p }: { p: CaseStudy }) {
  return (
    <MarcoNavegador className="relative">
      {p.image ? (
        // Se pide más de lo que se pinta (el navegador la reduce y el texto queda más
        // nítido); en móvil basta 100vw porque el DPR ya multiplica.
        <Image src={p.image} alt={`Captura de ${p.title}`} fill quality={90} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 150vw, 720px" className="object-cover" />
      ) : (
        <Maqueta variante={p.mock ?? 'series'} modulos={p.flow ?? []} />
      )}
    </MarcoNavegador>
  )
}

// Proyectos como casos de estudio: tres tarjetas iguales con la ficha corta;
// el caso completo se abre en un modal.
export function Projects({ t }: { t: Content }) {
  return (
    <section id="proyectos" className={seccion}>
      <SectionHeader eyebrow={t.projectsTitle} headline={t.projectsHeadline} intro={t.projectsIntro} />
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        {t.projects.map((p, i) => (
          <TarjetaCaso
            key={p.title}
            p={p}
            labels={t.caseLabels}
            scratch={t.scratch}
            numero={String(i + 1).padStart(2, '0')}
            delay={i * 80}
            ventana={<VentanaCaso p={p} />}
          />
        ))}
      </div>
    </section>
  )
}

export function About({ t }: { t: Content }) {
  return (
    <section id="sobre-mi" className={seccion}>
      <SectionHeader eyebrow={t.about.title} headline={t.about.headline} />
      <div className="grid gap-4 lg:grid-cols-5 lg:gap-5">
        {/* Retrato a sangre: la tarjeta es el marco. Sin optimizador (ver CHANGELOG). */}
        <Reveal className={cn(tarjeta, 'aspect-4/5 sm:aspect-square lg:col-span-2 lg:aspect-auto')}>
          <Image
            src="/img/adrian.webp"
            alt="Adrián Osuna"
            fill
            unoptimized
            sizes="(max-width: 1024px) 100vw, 440px"
            className="object-cover object-top"
          />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/60 to-transparent" />
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <MapPin className="size-3.5" />
            {t.about.facts[3].value}
          </span>
        </Reveal>
        <Reveal delay={80} className={cn(tarjeta, 'flex flex-col justify-between gap-8 p-6 sm:p-8 lg:col-span-3')}>
          <p className="text-lg leading-relaxed text-foreground sm:text-xl">{t.about.text}</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {t.about.facts.map((f) => (
              <div key={f.label} className="rounded-xl border border-white/8 bg-white/3 px-4 py-3.5">
                <dt className={etiqueta}>{f.label}</dt>
                <dd className="mt-1 text-[15px] font-medium text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}

// Cómo trabajo: cuatro principios en tarjetas, con icono y numeral.
const ICONOS_PRINCIPIOS = [Search, Database, Server, FileText]

export function HowIWork({ t }: { t: Content }) {
  return (
    <section id="como-trabajo" className={seccion}>
      <SectionHeader eyebrow={t.work.title} headline={t.work.headline} intro={t.work.intro} />
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {t.work.principles.map((p, i) => {
          const Icono = ICONOS_PRINCIPIOS[i] ?? Search
          return (
            <Reveal key={p.title} as="li" delay={i * 80} className={cn(tarjeta, 'flex flex-col p-6')}>
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                  <Icono className="size-4.5" />
                </span>
                <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-foreground">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-body">{p.text}</p>
            </Reveal>
          )
        })}
      </ol>
    </section>
  )
}

export function Experience({ t }: { t: Content }) {
  return (
    <section id="experiencia" className={seccion}>
      <SectionHeader eyebrow={t.experienceTitle} headline={t.experienceHeadline} />
      <div className="grid gap-4 lg:gap-5">
        {t.experience.map((c, ci) => {
          // Emparejado por id (no por posición): reordenar arrays no mezcla empresas.
          const tl = TIMELINE.find((x) => x.id === c.company)
          if (!tl) return null
          return (
            <Reveal key={c.company} as="article" delay={ci * 80} className={cn(tarjeta, 'grid gap-6 p-6 sm:p-8 lg:grid-cols-3 lg:gap-10')}>
              <header className="flex items-start gap-4">
                <CompanyLogo name={tl.name} src={tl.logo} />
                <div>
                  <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{tl.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.employment} · {c.place}
                  </p>
                  <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/4 px-2.5 py-0.5 text-xs font-medium text-body">
                    {companyDuration(tl.roles)}
                  </p>
                </div>
              </header>
              {/* Línea de tiempo: un punto por puesto sobre un filo vertical. */}
              <div className="flex flex-col gap-7 border-l border-white/10 pl-6 lg:col-span-2">
                {c.roles.map((r, ri) => {
                  const rt = tl.roles[ri]
                  return (
                    <div
                      key={ri}
                      className="relative before:absolute before:-left-7.25 before:top-1.5 before:size-2.5 before:rounded-full before:bg-primary before:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_20%,transparent)] before:content-['']">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h4 className="text-base font-semibold text-foreground">{r.role}</h4>
                        <span className="font-mono text-xs text-muted-foreground">
                          {rt ? periodLabel(rt.start, 'end' in rt ? rt.end : undefined) : ''}
                        </span>
                      </div>
                      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-body marker:text-muted-foreground">
                        {r.points.map((p, k) => (
                          <li key={k}>{p}</li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {r.stack.map((s) => (
                          <span key={s} className={chip}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

export function Contact({ t }: { t: Content }) {
  const redes = [
    { href: PROFILE.linkedin, label: 'LinkedIn', Icon: FaLinkedin },
    { href: PROFILE.github, label: 'GitHub', Icon: FaGithub },
  ]
  return (
    <section id="contacto" className={seccion}>
      <Reveal className={cn(tarjeta, 'px-6 py-14 text-center sm:px-10 sm:py-20')}>
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_100%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_70%)]" />
        <div aria-hidden="true" className="pf-grid absolute inset-0 mask-[radial-gradient(ellipse_60%_80%_at_50%_100%,#000_10%,transparent_75%)]" />
        <div className="relative mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            {t.contact.title}
          </span>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl sm:leading-[1.05]">
            {t.contact.headline}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-body sm:text-lg">{t.contact.text}</p>
          {/* Disponibilidad: punto verde con latido (quieto con reduced-motion). */}
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
              <span className="relative size-2 rounded-full bg-primary" />
            </span>
            {t.contact.availability}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a className={btnPrimario} href={`mailto:${PROFILE.email}`} data-ga="clic_email">
              <Mail className="size-4" />
              {PROFILE.email}
            </a>
            {redes.map(({ href, label, Icon }) => (
              <a
                key={label}
                className={btnSecundario}
                href={href}
                target="_blank"
                rel="noreferrer"
                data-ga={`clic_${label.toLowerCase()}`}>
                <Icon className="size-4" />
                {label}
              </a>
            ))}
          </div>
          <p className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            {t.footer.location}
          </p>
        </div>
      </Reveal>
    </section>
  )
}

export function Footer({ t }: { t: Content }) {
  const enlacePie = 'py-1 transition-colors hover:text-foreground'
  return (
    <footer className="border-t border-white/8">
      <div className={cn(contenedor, 'flex flex-col gap-8 py-10 sm:flex-row sm:items-center sm:justify-between')}>
        <div className="flex items-center gap-4">
          {/* Decorativa: el nombre va en el © de debajo. Ver `ui/logotipo.tsx`. */}
          <Logotipo className="h-5 w-auto shrink-0 text-foreground" />
          <p className="max-w-xs text-sm leading-snug text-muted-foreground">{t.footer.blurb}</p>
        </div>
        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <a className={enlacePie} href="#proyectos">{t.nav.projects}</a>
          <a className={enlacePie} href="#sobre-mi">{t.nav.about}</a>
          <a className={enlacePie} href="#como-trabajo">{t.nav.work}</a>
          <a className={enlacePie} href="#experiencia">{t.nav.experience}</a>
          <a className={enlacePie} href="#contacto">{t.nav.contact}</a>
          <a className={enlacePie} href={PROFILE.linkedin} target="_blank" rel="noreferrer" data-ga="clic_linkedin">LinkedIn</a>
          <a className={enlacePie} href={PROFILE.github} target="_blank" rel="noreferrer" data-ga="clic_github">GitHub</a>
        </nav>
      </div>
      <div className={contenedor}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 py-5 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} {PROFILE.name} · {t.footer.rights}</span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="/privacidad" className={enlacePie}>
              Política de privacidad
            </Link>
            {/* El acceso al dashboard va aquí y no en la barra: es privado, por invitación. */}
            <Link href="/app" className={enlacePie}>
              {t.nav.dashboard}
            </Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
