'use client'

// Revelado al hacer scroll: envuelve un bloque con la clase .reveal y alterna
// .is-visible al entrar/salir de pantalla (observer compartido entre todos los
// bloques). Respeta la preferencia de "reducir movimiento".
import { useEffect, useRef, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

let sharedObserver: IntersectionObserver | null = null

const getObserver = () => {
  sharedObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle('is-visible', entry.isIntersecting)
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  )
  return sharedObserver
}

interface RevealProps {
  as?: ElementType
  className?: string
  /** Retardo de la transición en ms (escalonar listas). */
  delay?: number
  /**
   * Entrada inmediata por CSS puro (sin observer ni hidratación): para el
   * contenido sobre el pliegue (hero) — de otro modo nace con opacity 0 hasta
   * que React hidrata y el LCP se dispara en móviles lentos.
   */
  inmediata?: boolean
  children: ReactNode
}

export function Reveal({ as: Tag = 'div', className, delay, inmediata, children }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (inmediata) return
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible')
      return
    }
    const observer = getObserver()
    observer.observe(el)
    return () => observer.unobserve(el)
  }, [inmediata])

  if (inmediata) {
    return (
      <Tag
        className={cn('pf-entrada', className)}
        style={delay ? { animationDelay: `${delay}ms` } : undefined}>
        {children}
      </Tag>
    )
  }

  return (
    <Tag
      ref={ref}
      className={cn('reveal', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  )
}
