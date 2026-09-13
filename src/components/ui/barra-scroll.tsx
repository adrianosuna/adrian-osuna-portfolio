'use client'

// Barra de scroll flotante de la página: sigue al scroll nativo (que queda
// oculto por CSS) y está siempre a la vista. Solo con puntero fino; en táctil
// se deja la del sistema.
import { useEffect, useRef, useState } from 'react'

const MIN_PULGAR = 32

export function BarraScroll() {
  const [activa, setActiva] = useState(false)
  const [geom, setGeom] = useState({ alto: 0, top: 0 })
  const arrastre = useRef<{ y: number; scroll: number; escala: number } | null>(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    const doc = document.documentElement

    const medir = () => {
      const total = doc.scrollHeight
      const vista = window.innerHeight
      const desborda = total > vista + 1
      setActiva(desborda)
      if (!desborda) return
      const alto = Math.max(MIN_PULGAR, (vista / total) * vista)
      setGeom({ alto, top: (window.scrollY / (total - vista)) * (vista - alto) })
    }

    medir()
    window.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)
    const observador = new ResizeObserver(medir)
    observador.observe(document.body)
    return () => {
      window.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
      observador.disconnect()
    }
  }, [])

  // Arrastre del pulgar: un píxel de pulgar son `escala` píxeles de página.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const total = document.documentElement.scrollHeight
    const vista = window.innerHeight
    arrastre.current = { y: e.clientY, scroll: window.scrollY, escala: (total - vista) / (vista - geom.alto) }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current
    if (!a) return
    window.scrollTo({ top: a.scroll + (e.clientY - a.y) * a.escala, behavior: 'instant' })
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    arrastre.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
  // Clic en la pista: centra el pulgar donde se ha pulsado.
  const onPistaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const total = document.documentElement.scrollHeight
    const vista = window.innerHeight
    const top = Math.min(Math.max(e.clientY - geom.alto / 2, 0), vista - geom.alto)
    window.scrollTo({ top: (top / (vista - geom.alto)) * (total - vista) })
  }

  if (!activa) return null
  return (
    <div aria-hidden="true" onClick={onPistaClick} className="fixed inset-y-0 right-0 z-45 w-3">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ height: geom.alto, transform: `translateY(${geom.top}px)` }}
        className="absolute right-1 w-1.5 cursor-default touch-none rounded-full bg-white/25 transition-[width,background-color] hover:w-2 hover:bg-white/40 active:bg-primary"
      />
    </div>
  )
}
