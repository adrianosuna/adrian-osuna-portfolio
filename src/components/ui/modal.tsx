'use client'

// Modal reutilizable del dashboard: cabecera fija (título + botón de cierre),
// cuerpo con scroll propio y pie de acciones siempre visible. Cierra con
// Escape y con clic en el fondo, y bloquea el scroll de la página mientras
// está abierto. Los popovers de fields.tsx (calendario, select) se renderizan
// en un portal con posición fija, así que nunca los recorta el scroll del
// cuerpo — usar siempre este componente para nuevos modales.
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Lo que puede recibir el foco con Tab dentro del modal, en orden de documento.
const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  title, description, onClose, footer, ancho = 'md', children,
}: {
  title: string
  /** Subtítulo bajo el título. */
  description?: string
  onClose: () => void
  /** Acciones del pie (normalmente Cancelar + acción principal). */
  footer?: React.ReactNode
  ancho?: 'md' | 'lg'
  children: React.ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const cuerpo = useRef<HTMLDivElement>(null)

  // Scroll del fondo y foco, SOLO al abrir y al cerrar: va aparte del listener
  // de teclado a propósito. Ese depende de `onClose`, que en varias llamadas es
  // una función inline y cambia en cada render; si el foco viviera en el mismo
  // efecto, cada render lo devolvería al primer campo mientras escribes.
  useEffect(() => {
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Quien tenía el foco al abrir, para devolvérselo al cerrar: si no, el foco
    // cae al <body> y el siguiente Tab empieza por el principio de la página en
    // vez de por donde estabas.
    const antes = document.activeElement as HTMLElement | null

    // Foco inicial en el primer control del CUERPO (no en la "X" de la
    // cabecera, que es el primero del panel y dejaría el Enter en "cerrar").
    // Solo si ningún campo se lo ha llevado ya con autoFocus; sin esto el foco
    // se queda en el botón que abrió el modal —fuera de él— y el primer Tab se
    // va a la página de detrás.
    if (!panel.current?.contains(document.activeElement)) {
      ;(cuerpo.current?.querySelector<HTMLElement>(ENFOCABLES) ?? panel.current)?.focus()
    }

    return () => {
      document.body.style.overflow = previo
      antes?.focus?.()
    }
  }, [])

  // Escape cierra (los popovers abiertos frenan la tecla antes de llegar
  // aquí: primero se cierra el popover, luego el modal) y Tab da la vuelta
  // dentro del modal en vez de escaparse a la página de detrás.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      // Con un popover de fields.tsx abierto el foco está en un portal FUERA
      // del panel: ahí no se atrapa nada, o tabular por el calendario saltaría
      // de vuelta al formulario.
      if (!panel.current.contains(document.activeElement)) return

      const focos = [...panel.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (!focos.length) return
      const primero = focos[0]
      const ultimo = focos[focos.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // tabIndex -1: no entra en el orden de Tab, pero permite darle el foco
        // a mano cuando el modal no tiene ningún control dentro (un aviso).
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-xl',
          ancho === 'lg' ? 'max-w-lg' : 'max-w-md',
        )}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-snug">{title}</h3>
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            // En móvil es el control con el que se sale del modal: 28px era
            // un objetivo escaso, p-2.5 lo deja en 36.
            className="-mr-1.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-sm:p-2.5"
            aria-label="Cerrar"
            onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        <div ref={cuerpo} className="overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</div>
        )}
      </div>
    </div>
  )
}
