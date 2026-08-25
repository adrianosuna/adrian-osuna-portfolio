'use client'

// Secciones de la landing pública. Todas reciben el contenido `t` ya resuelto;
// las fechas/duraciones de experiencia se calculan al vuelo. La página gira
// alrededor de los casos de estudio: hero con posicionamiento → cifras →
// proyectos → sobre mí → experiencia → contacto.
import { Fragment, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight, ChevronDown, ExternalLink, Hammer, Mail, MapPin,
} from 'lucide-react'
// lucide retiró los iconos de marcas; GitHub y LinkedIn vienen de react-icons.
import { FaGithub, FaLinkedin } from 'react-icons/fa6'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/landing/reveal'
import {
  PROFILE, TIMELINE, companyDuration, periodLabel, yearsSince,
  type Content,
} from '@/lib/landing/content'

const sectionClass = 'mx-auto w-full max-w-245 px-[6%] py-14 sm:py-18'

function SectionTitle({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <Reveal
      as="h2"
      className={cn(
        'pf-section-title mb-7 text-[22px] font-bold tracking-[-0.5px] text-foreground sm:text-[26px]',
        center && 'pf-section-title--center',
      )}>
      {children}
    </Reveal>
  )
}

function Chip({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-lg border border-border bg-card font-mono text-body transition-colors hover:border-primary hover:text-primary',
        small ? 'px-2.25 py-0.75 text-xs' : 'px-3 py-1.5 text-[13px]',
      )}>
      {children}
    </span>
  )
}

export function Hero({ t }: { t: Content }) {
  const socials = [
    { href: PROFILE.github, label: 'GitHub', Icon: FaGithub },
    { href: PROFILE.linkedin, label: 'LinkedIn', Icon: FaLinkedin },
    { href: `mailto:${PROFILE.email}`, label: 'Email', Icon: Mail },
  ]
  return (
    <section className="relative">
      {/* Glow esmeralda sutil tras el titular (sigue al color primario del tema) */}
      <div aria-hidden="true" className="pf-hero-glow" />
      {/* min(100svh, 56rem): a pantalla completa en portátiles, pero acotado en
          monitores altos para que las stats asomen sin un hueco enorme. */}
      <div className="relative mx-auto grid w-full max-w-300 items-center gap-10 px-6 pb-8 pt-28 sm:px-8 sm:pt-32 md:min-h-[min(calc(100svh-4rem),56rem)] md:grid-cols-[1fr_auto] md:gap-16 md:py-24">
        {/* Texto: centrado en móvil, alineado a la izquierda en escritorio */}
        <div className="order-2 text-center md:order-1 md:text-left">
          <Reveal as="p" className="font-mono text-[13px] uppercase tracking-[2px] text-accent-teal">
            {t.hero.hi}
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mb-1.5 mt-3 text-[clamp(42px,5vw,80px)] font-extrabold leading-[1.04] tracking-[-2px] text-foreground">
              {PROFILE.name}
            </h1>
          </Reveal>
          <Reveal delay={160}>
            {/* Cada título es indivisible: la línea solo puede partirse por el "·".
                El espacio entre spans es imprescindible: sin él no hay punto de
                ruptura y la línea entera desborda el ancho del móvil. */}
            <p className="text-[clamp(19px,1.8vw,27px)] font-semibold text-primary">
              {t.hero.role.split('·').map((parte, i, todas) => (
                <Fragment key={i}>
                  <span className="whitespace-nowrap">
                    {parte.trim()}
                    {i < todas.length - 1 && <span className="mx-2">·</span>}
                  </span>{' '}
                </Fragment>
              ))}
            </p>
          </Reveal>
          <Reveal as="p" delay={240} className="mx-auto mt-5 max-w-150 text-lg leading-[1.65] text-body md:mx-0 lg:text-xl">
            {t.hero.tagline}
          </Reveal>
          <Reveal delay={320} className="mt-5 inline-block">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[13.5px] text-muted-foreground">
              <MapPin className="size-3.5" />
              {t.hero.location}
            </span>
          </Reveal>
          {/* CTAs: la acción principal lleva a la evidencia (los proyectos) */}
          <Reveal delay={400} className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <a
              className="inline-flex items-center gap-2 rounded-xl bg-btn px-6 py-3 text-[15px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-btn-hover"
              href="#proyectos">
              {t.hero.ctaWork}
              <ArrowRight className="size-4" />
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-[15px] font-semibold text-primary transition-all hover:-translate-y-px hover:border-primary"
              href="#contacto">
              <Mail className="size-4" />
              {t.hero.ctaContact}
            </a>
          </Reveal>
          <Reveal delay={480} className="mt-7 flex items-center justify-center gap-2.5 md:justify-start">
            {socials.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noreferrer' : undefined}
                aria-label={label}
                title={label}
                className="flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                <Icon className="size-4.5" />
              </a>
            ))}
          </Reveal>
        </div>

        {/* Foto: marco redondeado con contorno teal desplazado detrás */}
        <Reveal delay={200} className="order-1 flex justify-center md:order-2">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute inset-0 translate-x-3 translate-y-3 rounded-[30px] border-2 border-accent-teal/60"
            />
            <Image
              src="/img/adrian.webp"
              alt="Adrián Osuna"
              width={400}
              height={400}
              priority
              className="relative size-44 rounded-[30px] border border-border object-cover shadow-[0_18px_50px_var(--pf-shadow)] sm:size-56 md:size-85 lg:size-100"
            />
          </div>
        </Reveal>
      </div>
      {/* Indicador de scroll anclado al fondo del primer pantallazo */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 hidden justify-center md:flex">
        <ScrollHint />
      </div>
      <div className="relative pb-6 md:hidden">
        <ScrollHint />
      </div>
    </section>
  )
}

// Indicador de scroll del hero: flecha con rebote suave que desaparece en
// cuanto el visitante hace el primer scroll. Sin animación con reduced-motion.
function ScrollHint() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      aria-hidden="true"
      className={cn('flex justify-center transition-opacity duration-500', scrolled && 'opacity-0')}>
      <ChevronDown className="size-6 animate-bounce text-muted-foreground/60 motion-reduce:animate-none" />
    </div>
  )
}

// Franja de cifras: credibilidad de un vistazo entre el hero y los proyectos.
// Los años se calculan desde las fechas reales (siempre al día).
export function Stats({ t }: { t: Content }) {
  const items = [
    { value: `${yearsSince({ y: 2021, m: 3 })}+`, label: t.stats.experience },
    { value: '2', label: t.stats.platforms },
    { value: '1º', label: t.stats.firstDev },
    { value: `${yearsSince({ y: 2024, m: 1 })}+`, label: t.stats.leading },
  ]
  return (
    <section className="mx-auto w-full max-w-245 px-[6%] pb-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
        {items.map((s, i) => (
          <Reveal key={s.label} delay={i * 70} className="bg-card px-4 py-6 text-center">
            <p className="font-mono text-3xl font-bold text-primary sm:text-4xl">{s.value}</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// Proyectos como casos de estudio: el reto → qué construí → el resultado.
// Es LA sección de la página; cada caso es una tarjeta ancha con su captura.
export function Projects({ t }: { t: Content }) {
  return (
    <section id="proyectos" className={sectionClass}>
      <SectionTitle>{t.projectsTitle}</SectionTitle>
      <div className="flex flex-col gap-6">
        {t.projects.map((p, i) => {
          const bloques = [
            { label: t.caseLabels.context, text: p.context },
            { label: t.caseLabels.built, text: p.built },
            { label: t.caseLabels.result, text: p.result },
          ]
          return (
            <Reveal
              key={p.title}
              as="article"
              delay={i * 90}
              // Franja de acento superior + elevación al pasar el cursor.
              className="relative overflow-hidden rounded-2xl border border-border bg-card transition-all before:absolute before:inset-x-0 before:top-0 before:z-1 before:h-0.75 before:bg-primary before:opacity-85 before:content-[''] hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_16px_40px_var(--pf-shadow)]">
              <div className="flex flex-col">
                {/* Captura encima del contenido (misma estructura en móvil y
                    escritorio): 16:9 en móvil y recorte panorámico en pantallas
                    grandes, para que no domine media pantalla. */}
                {p.image && (
                  <div className="relative aspect-video border-b border-border bg-logo-box md:aspect-[2.4/1]">
                    <Image
                      src={p.image}
                      alt={`Captura de ${p.title}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 980px"
                      className={cn('object-cover', p.imageTop && 'object-top')}
                    />
                  </div>
                )}
                <div className="flex flex-col p-5.5 sm:p-7">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-xl font-bold text-primary opacity-55">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-0.75 font-mono text-[11px] uppercase tracking-[0.6px] text-accent-teal">
                      {p.tag}
                    </span>
                  </div>
                  <h3 className="mb-4 text-[22px] font-semibold text-foreground">{p.title}</h3>

                  <div className="flex grow flex-col gap-3.5">
                    {bloques.map((b) => (
                      <div key={b.label}>
                        <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[1.5px] text-accent-teal">
                          {b.label}
                        </p>
                        <p className="hyphens-auto text-justify text-[14.5px] leading-relaxed text-body">{b.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {p.scratch && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary px-2.5 py-0.75 font-mono text-[11px] font-semibold uppercase tracking-[0.4px] text-primary">
                        <Hammer className="size-3 text-accent-teal" />
                        {t.scratch}
                      </span>
                    )}
                    {p.stack.map((s) => (
                      <Chip key={s} small>
                        {s}
                      </Chip>
                    ))}
                  </div>

                  {(p.url || p.repo) && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                      {p.url && (
                        <a
                          className="flex items-center gap-1.5 font-mono text-[14px] font-semibold text-primary hover:text-primary-dark"
                          href={p.url}
                          target="_blank"
                          rel="noreferrer">
                          {p.urlLabel} <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      {p.repo && (
                        <a
                          className="flex items-center gap-1.5 font-mono text-[14px] font-semibold text-primary hover:text-primary-dark"
                          href={p.repo}
                          target="_blank"
                          rel="noreferrer">
                          <FaGithub className="size-4" /> Ver el código
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

export function About({ t }: { t: Content }) {
  return (
    <section id="sobre-mi" className={sectionClass}>
      <SectionTitle>{t.about.title}</SectionTitle>
      {/* Dos columnas como el contacto: párrafo + ficha de datos rápidos. */}
      <div className="grid gap-8 md:grid-cols-[7fr_5fr] md:gap-14">
        <Reveal as="p" className="hyphens-auto text-justify text-[16.5px] leading-[1.75] text-body">
          {t.about.text}
        </Reveal>
        <Reveal delay={120} className="flex flex-col divide-y divide-border/60 self-start rounded-xl border border-border">
          {t.about.facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-4 px-4.5 py-3.5">
              <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[1.5px] text-accent-teal">
                {f.label}
              </span>
              <span className="text-right text-[14px] font-semibold text-body">{f.value}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

// Logo de empresa: muestra la imagen si existe; si falla la carga, cae a un
// monograma con las iniciales para no dejar el hueco roto.
function CompanyLogo({ name, src }: { name: string; src: string }) {
  const [err, setErr] = useState(false)
  const initials = name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
  return (
    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-logo-box">
      {src && !err ? (
        <Image src={src} alt={name} width={56} height={56} className="size-full object-contain p-2" onError={() => setErr(true)} />
      ) : (
        <span className="text-lg font-extrabold text-primary">{initials}</span>
      )}
    </div>
  )
}

export function Experience({ t }: { t: Content }) {
  return (
    <section id="experiencia" className={sectionClass}>
      <SectionTitle>{t.experienceTitle}</SectionTitle>
      <div className="flex flex-col gap-9">
        {t.experience.map((c, ci) => {
          // Emparejado por id (no por posición): reordenar arrays no mezcla empresas.
          const tl = TIMELINE.find((x) => x.id === c.company)
          if (!tl) return null
          const meta = `${c.employment} · ${companyDuration(tl.roles)} · ${c.place}`
          return (
            <Reveal
              key={c.company}
              as="article"
              delay={ci * 90}
              className="rounded-2xl border border-border bg-card px-5 py-5 shadow-[0_1px_2px_var(--pf-shadow)] sm:px-6.5 sm:py-6">
              <header className="mb-5 flex items-center gap-4">
                <CompanyLogo name={tl.name} src={tl.logo} />
                <div>
                  <h3 className="text-xl font-bold text-foreground">{tl.name}</h3>
                  <span className="font-mono text-[13px] text-muted-foreground">{meta}</span>
                </div>
              </header>
              {/* Timeline: línea vertical con un punto por puesto. */}
              <div className="ml-5 flex flex-col gap-5.5 border-l border-border pl-5.5 sm:ml-6.75 sm:pl-7">
                {c.roles.map((r, ri) => {
                  const rt = tl.roles[ri]
                  return (
                    <div
                      key={ri}
                      className="relative before:absolute before:-left-7.25 before:top-1.5 before:size-2.75 before:rounded-full before:bg-primary before:shadow-[0_0_0_4px_rgba(5,150,105,0.16)] before:content-[''] sm:before:-left-8.75">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <strong className="text-base font-semibold text-foreground">{r.role}</strong>
                        <span className="whitespace-nowrap font-mono text-[13px] text-muted-foreground">
                          {rt ? periodLabel(rt.start, 'end' in rt ? rt.end : undefined) : ''}
                        </span>
                      </div>
                      <ul className="mb-3 mt-2.5 list-disc space-y-1.5 pl-4.5 hyphens-auto text-justify text-[15px] leading-[1.65] text-body">
                        {r.points.map((p, k) => (
                          <li key={k}>{p}</li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-2.5">
                        {r.stack.map((s) => (
                          <Chip key={s} small>
                            {s}
                          </Chip>
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
    <section id="contacto" className={sectionClass}>
      <SectionTitle>{t.contact.title}</SectionTitle>
      {/* Dos columnas editorial: mensaje a la izquierda, acciones a la derecha. */}
      <div className="grid gap-10 md:grid-cols-[7fr_5fr] md:gap-14">
        <Reveal>
          <h3 className="text-[clamp(26px,3vw,38px)] font-extrabold leading-[1.15] tracking-[-1px] text-foreground">
            {t.contact.headline}
          </h3>
          <p className="mt-4 max-w-130 hyphens-auto text-justify text-[16.5px] leading-[1.75] text-body">
            {t.contact.text}
          </p>
          <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            {t.footer.location}
          </span>
        </Reveal>

        <Reveal delay={120} className="flex flex-col gap-3">
          <a
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-btn px-4 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-btn-hover"
            href={`mailto:${PROFILE.email}`}>
            <Mail className="size-4 shrink-0" />
            {/* <wbr> tras el usuario: si el correo no cabe en una línea, parte
                limpiamente por la @ en vez de cortarse por cualquier sitio. */}
            <span className="min-w-0 text-center">
              {PROFILE.email.split('@')[0]}
              <wbr />@{PROFILE.email.split('@')[1]}
            </span>
          </a>
          <div className="mt-2 flex flex-col divide-y divide-border/60 rounded-xl border border-border">
            {redes.map(({ href, label, Icon }) => (
              <a
                key={label}
                className="group flex items-center justify-between px-4.5 py-3.5 text-[15px] font-semibold text-body transition-colors hover:text-primary"
                href={href}
                target="_blank"
                rel="noreferrer">
                <span className="flex items-center gap-2.5">
                  <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  {label}
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
              </a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function Footer({ t }: { t: Content }) {
  return (
    <footer className="border-t border-border bg-card">
      <Reveal className="mx-auto grid w-full max-w-250 gap-7 px-[6%] pt-12 sm:grid-cols-2 sm:pt-14 md:grid-cols-[2fr_1fr_1fr] md:gap-8">
        <div className="sm:col-span-2 md:col-span-1">
          <span className="text-[22px] font-extrabold tracking-[-0.5px] text-foreground">
            AO<span className="text-accent-teal">.</span>
          </span>
          <p className="mt-2.5 font-semibold text-foreground">{PROFILE.name}</p>
          <p className="mt-2 max-w-80 text-sm leading-relaxed text-muted-foreground">{t.footer.blurb}</p>
        </div>
        <div className="flex flex-col items-start gap-2.5 text-sm">
          <h3 className="mb-1 text-sm font-semibold tracking-[0.3px] text-foreground">{t.footer.navTitle}</h3>
          <a className="text-muted-foreground transition-colors hover:text-primary" href="#proyectos">{t.nav.projects}</a>
          <a className="text-muted-foreground transition-colors hover:text-primary" href="#sobre-mi">{t.nav.about}</a>
          <a className="text-muted-foreground transition-colors hover:text-primary" href="#experiencia">{t.nav.experience}</a>
          <a className="text-muted-foreground transition-colors hover:text-primary" href="#contacto">{t.nav.contact}</a>
        </div>
        <div className="flex flex-col items-start gap-2.5 text-sm">
          <h3 className="mb-1 text-sm font-semibold tracking-[0.3px] text-foreground">{t.footer.contactTitle}</h3>
          <a className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary" href={`mailto:${PROFILE.email}`}>
            <Mail className="size-3.5" />
            {PROFILE.email}
          </a>
          <a
            className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary"
            href={PROFILE.linkedin}
            target="_blank"
            rel="noreferrer">
            <FaLinkedin className="size-3.5" />
            LinkedIn
          </a>
          <a
            className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary"
            href={PROFILE.github}
            target="_blank"
            rel="noreferrer">
            <FaGithub className="size-3.5" />
            GitHub
          </a>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-3.5" />
            {t.footer.location}
          </span>
        </div>
      </Reveal>
      <div className="mx-auto mt-10 w-full max-w-250 px-[6%]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-5 text-[13px] text-muted-foreground">
          <span>© {new Date().getFullYear()} {PROFILE.name}</span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="/privacidad" className="transition-colors hover:text-primary">
              Política de privacidad
            </Link>
            <span>{t.footer.rights}</span>
          </span>
        </div>
      </div>
    </footer>
  )
}
