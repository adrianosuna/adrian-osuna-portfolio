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

/**
 * Pila de modales abiertos, para que **Escape cierre solo el de arriba**.
 *
 * ⚠ El listener de Escape es de `document`, así que con dos modales apilados
 * —y se apilan: una confirmación se pinta sobre el modal que la pidió— la tecla
 * llegaba a los dos y cerraba el de abajo también. El síntoma es raro de leer:
 * cancelas una confirmación y se te va la pantalla entera de detrás.
 *
 * La identidad es el propio objeto que mete cada modal al montarse (no un
 * contador: con StrictMode montando dos veces, un número se descuadra).
 */
const pila: object[] = []

/**
 * El `overflow` que tenía la página ANTES del primer modal, para devolverlo
 * cuando se cierre el último.
 *
 * ⚠ Module-level y no una copia por modal: el segundo modal se abre cuando el
 * body ya está en `hidden`, así que su copia ES "hidden" — y si se desmonta
 * DESPUÉS del primero (el orden no está garantizado: dos hermanos del mismo
 * árbol se limpian en orden de documento), era él quien restauraba, y la
 * página se quedaba sin scroll para siempre. Lo encontró un test.
 */
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

  // Scroll del fondo y foco, SOLO al abrir y al cerrar: va aparte del listener
  // de teclado a propósito. Ese depende de `onClose`, que en varias llamadas es
  // una función inline y cambia en cada render; si el foco viviera en el mismo
  // efecto, cada render lo devolvería al primer campo mientras escribes.
  useEffect(() => {
    const marca = yo.current
    // El original lo guarda solo el PRIMERO de la pila (ver `overflowPrevio`).
    if (!pila.length) overflowPrevio = document.body.style.overflow
    pila.push(marca)
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
      const i = pila.lastIndexOf(marca)
      if (i !== -1) pila.splice(i, 1)
      // El scroll del fondo se recupera solo cuando NO queda ningún modal: con
      // dos apilados, cerrar el de arriba devolvía el scroll a la página de
      // detrás mientras el de abajo seguía abierto.
      document.body.style.overflow = pila.length ? 'hidden' : overflowPrevio
      antes?.focus?.()
    }
  }, [])

  // Escape cierra (los popovers abiertos frenan la tecla antes de llegar
  // aquí: primero se cierra el popover, luego el modal) y Tab da la vuelta
  // dentro del modal en vez de escaparse a la página de detrás.
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
