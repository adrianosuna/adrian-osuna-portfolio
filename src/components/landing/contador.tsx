'use client'

// Contador animado de la franja de cifras: cuenta de 0 al valor al entrar en
// pantalla (una sola vez, easing suave). El servidor renderiza el valor FINAL
// (SEO y sin-JS ven la cifra real); con `prefers-reduced-motion` no se anima.
import { useEffect, useRef, useState } from 'react'

export function Contador({ numero, sufijo = '' }: { numero: number; sufijo?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [valor, setValor] = useState(numero)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return // se queda el valor final, sin animación
    }

    let raf = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        const inicio = performance.now()
        const duracion = 900
        const paso = (ahora: number) => {
          const t = Math.min(1, (ahora - inicio) / duracion)
          const suavizado = 1 - Math.pow(1 - t, 3) // easeOutCubic
          setValor(Math.round(numero * suavizado))
          if (t < 1) raf = requestAnimationFrame(paso)
        }
        setValor(0)
        raf = requestAnimationFrame(paso)
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [numero])

  return (
    <span ref={ref}>
      {valor}
      {sufijo}
    </span>
  )
}
