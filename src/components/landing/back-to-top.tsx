'use client'

// Botón "volver arriba": aparece tras ~600px de scroll, esquina inferior
// derecha. El desplazamiento suave lo da el scroll-smooth global (que ya se
// desactiva con reduced-motion).
import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      aria-label="Volver arriba"
      title="Volver arriba"
      // Algunas extensiones/navegadores inyectan un style inline en botones
      // fijos antes de hidratar; sin esto React avisa de un mismatch espurio.
      suppressHydrationWarning
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0 })}
      className={cn(
        'fixed bottom-5 right-5 z-30 flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-[0_6px_18px_var(--pf-shadow)] transition-all hover:-translate-y-0.5 hover:border-primary hover:text-primary',
        visible ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
      )}>
      <ArrowUp className="size-4.5" />
    </button>
  )
}
