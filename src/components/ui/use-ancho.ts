'use client'

// Medida del ancho REAL del contenedor de una gráfica.
//
// Las gráficas del dashboard son SVG a mano con `w-full`: un lienzo de tamaño
// fijo estirado así escala TODO con él (un lienzo de 760 pintado en 1053px
// agranda las fuentes un 39%, y a 1085px un lienzo de 520 pintaba la fuente de
// 10,5 a 21px). Midiendo el hueco, el lienzo se genera con ese ancho y la
// gráfica se pinta siempre a escala 1:1 — sin variantes por breakpoint.
import { useEffect, useRef, useState } from 'react'

export function useAncho() {
  const ref = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // La primera medida es SÍNCRONA a propósito: un ResizeObserver solo avisa
    // cuando el navegador vuelve a componer, y hay contextos (una pestaña de
    // fondo, un panel oculto) donde ese aviso no llega nunca y la gráfica se
    // quedaría en blanco. El observer y el resize cubren los cambios después.
    const medir = () => setAncho(el.clientWidth)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    window.addEventListener('resize', medir)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [])
  return [ref, ancho] as const
}
