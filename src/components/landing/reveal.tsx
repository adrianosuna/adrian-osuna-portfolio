'use client'

// Revelado al hacer scroll: alterna .is-visible con un observer compartido.
// Respeta "reducir movimiento".
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
  /** Entrada inmediata por CSS, sin observer: para el contenido sobre el pliegue,
   *  que si no nace con opacity 0 hasta hidratar y dispara el LCP. */
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
