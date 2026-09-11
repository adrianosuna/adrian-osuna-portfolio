'use client'

// Barra de carga global bajo la barra superior. Los cambios por query param no
// disparan loading.tsx: se detecta el clic en <a> interno o `iniciar()` de los tabs.
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const CargaCtx = createContext<() => void>(() => {})

/** Dispara la barra al navegar con `router.push` (los tabs son botones, no <a>). */
export const useCarga = () => useContext(CargaCtx)

export function BarraCargaProvider({ children }: { children: React.ReactNode }) {
  const [activa, setActiva] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const iniciar = () => {
    setActiva(true)
    // Red de seguridad: si la ruta no cambiara, la barra no se queda encendida.
    // `iniciar` limpia el timeout anterior.
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(() => setActiva(false), 8000)
  }

  // Ruta asentada → apagar. En render y no en un efecto: el React Compiler no
  // permite setState síncrono dentro de useEffect.
  const ruta = pathname + '?' + searchParams.toString()
  const [prevRuta, setPrevRuta] = useState(ruta)
  if (prevRuta !== ruta) {
    setPrevRuta(ruta)
    if (activa) setActiva(false)
  }

  // Los <a> internos (Link, barra superior) disparan la barra sin tocar cada uno.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement).closest('a')
      if (!a || a.target === '_blank' || a.hasAttribute('download') || a.origin !== location.origin) return
      // Solo si de verdad se va a otra URL.
      if (a.pathname + a.search !== location.pathname + location.search) iniciar()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <CargaCtx.Provider value={iniciar}>
      {activa && <div className="barra-carga" role="progressbar" aria-label="Cargando" />}
      {children}
    </CargaCtx.Provider>
  )
}
