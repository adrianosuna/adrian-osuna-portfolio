'use client'

// Tarjeta de un caso de estudio: la única isla cliente de Proyectos. La ventana
// (captura o maqueta) llega ya pintada desde el servidor y se reutiliza en el
// modal.
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, BookOpen, Hammer } from 'lucide-react'
import { FaGithub } from 'react-icons/fa6'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Reveal } from '@/components/landing/reveal'
import { chip, enlace, etiqueta, tarjeta } from '@/components/landing/estilos'
import type { CaseStudy, Content } from '@/lib/landing/content'

export function TarjetaCaso({
  p, labels, scratch, numero, delay, ventana,
}: {
  p: CaseStudy
  labels: Content['caseLabels']
  scratch: string
  numero: string
  delay: number
  ventana: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const bloques = [
    { label: labels.context, text: p.context },
    { label: labels.built, text: p.built },
    { label: labels.result, text: p.result },
  ]
  const enlaces = (
    <>
      {p.url && (
        <a className={enlace} href={p.url} target="_blank" rel="noreferrer" data-ga="clic_demo">
          {p.urlLabel}
          <ArrowUpRight className="size-4" />
        </a>
      )}
      {p.repo && (
        <a className={enlace} href={p.repo} target="_blank" rel="noreferrer" data-ga="clic_repo">
          <FaGithub className="size-4" />
          Ver el código
        </a>
      )}
    </>
  )
  return (
    <Reveal as="article" delay={delay} className={cn(tarjeta, 'flex flex-col')}>
      <div className="relative border-b border-white/8 p-5 sm:p-6">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_100%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_70%)]" />
        <div aria-hidden="true" className="pf-grid absolute inset-0 mask-[radial-gradient(ellipse_80%_80%_at_50%_100%,#000_10%,transparent_75%)]" />
        {ventana}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">{numero}</span>
          <span className="rounded-full border border-white/10 bg-white/4 px-2.5 py-0.5 font-medium text-body">{p.tag}</span>
          {p.scratch && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
              <Hammer className="size-3" />
              {scratch}
            </span>
          )}
        </div>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-foreground">{p.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-body">{p.subtitle}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {p.stack.map((s) => (
            <span key={s} className={chip}>{s}</span>
          ))}
        </div>
        {/* mt-auto: el pie queda a la misma altura en las tres tarjetas. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/8 pt-4">
          <button type="button" onClick={() => setAbierto(true)} className={enlace}>
            <BookOpen className="size-4" />
            {labels.open}
          </button>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">{enlaces}</span>
        </div>
      </div>
      {/* Portal: el envoltorio de revelado lleva translate y will-change, que harían
          al fixed del modal relativo a la tarjeta, y su overflow lo recortaría. */}
      {abierto && createPortal(
        <Modal title={p.title} description={p.subtitle} ancho="lg" onClose={() => setAbierto(false)}>
          <div className="space-y-6">
            {ventana}
            <dl className="space-y-5">
              {bloques.map((b) => (
                <div key={b.label}>
                  <dt className={etiqueta}>{b.label}</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed text-body">{b.text}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-1.5">
              {p.stack.map((s) => (
                <span key={s} className={chip}>{s}</span>
              ))}
            </div>
            {(p.url || p.repo) && <div className="flex flex-wrap items-center gap-x-5 gap-y-2">{enlaces}</div>}
          </div>
        </Modal>,
        document.body,
      )}
    </Reveal>
  )
}
