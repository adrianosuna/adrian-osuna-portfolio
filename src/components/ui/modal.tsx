'use client'

// Modal reutilizable: cabecera fija, cuerpo con scroll y pie visible. Cierra con
// Escape y clic en el fondo, y bloquea el scroll de la página. Usar siempre este.
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Lo que puede recibir el foco con Tab dentro del modal, en orden de documento.
const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Pila de modales abiertos para que Escape cierre solo el de arriba: el listener
 *  es de document y con dos apilados cerraba los dos. Identidad por objeto, no contador. */
const pila: object[] = []

/** El overflow de la página antes del primer modal. A nivel de módulo: la copia del
 *  segundo modal ya es "hidden" y, si se desmontaba después, dejaba la página sin scroll. */
let overflowPrevio = ''

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
  /** Marca de este modal en la pila (ver `pila`). */
  const yo = useRef({})

  // Scroll del fondo y foco solo al abrir y cerrar, aparte del listener de teclado:
  // ese depende de `onClose`, que cambia en cada render, y devolvería el foco al escribir.
  useEffect(() => {
    const marca = yo.current
    // El original lo guarda solo el PRIMERO de la pila (ver `overflowPrevio`).
    if (!pila.length) overflowPrevio = document.body.style.overflow
    pila.push(marca)
    document.body.style.overflow = 'hidden'

    // Quien tenía el foco al abrir, para devolvérselo al cerrar: si no, cae al body y
    // el siguiente Tab empieza por el principio de la página.
    const antes = document.activeElement as HTMLElement | null

    // Foco inicial en el primer control del cuerpo (no en la X de la cabecera), salvo
    // que un campo tenga autoFocus. Sin esto el foco se queda en el botón que abrió.
    if (!panel.current?.contains(document.activeElement)) {
      ;(cuerpo.current?.querySelector<HTMLElement>(ENFOCABLES) ?? panel.current)?.focus()
    }

    return () => {
      const i = pila.lastIndexOf(marca)
      if (i !== -1) pila.splice(i, 1)
      // El scroll del fondo se recupera solo cuando no queda ningún modal: cerrar el de
      // arriba no debe devolverlo mientras el de abajo sigue abierto.
      document.body.style.overflow = pila.length ? 'hidden' : overflowPrevio
      antes?.focus?.()
    }
  }, [])

  // Escape cierra (un popover abierto frena la tecla antes: primero él, luego el
  // modal) y Tab da la vuelta dentro del modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Solo el modal de ARRIBA atiende las teclas: si no, Escape cerraría
      // también el de debajo y el Tab de los dos pelearía por el foco.
      if (pila[pila.length - 1] !== yo.current) return
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      // Con un popover de fields.tsx abierto el foco está en un portal fuera del panel:
      // ahí no se atrapa, o tabular por el calendario saltaría al formulario.
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
            className="-mr-1.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground max-sm:p-2.5"
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
