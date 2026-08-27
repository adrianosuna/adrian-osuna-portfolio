'use client'

// Modal reutilizable del dashboard: cabecera fija (título + botón de cierre),
// cuerpo con scroll propio y pie de acciones siempre visible. Cierra con
// Escape y con clic en el fondo, y bloquea el scroll de la página mientras
// está abierto. Los popovers de fields.tsx (calendario, select) se renderizan
// en un portal con posición fija, así que nunca los recorta el scroll del
// cuerpo — usar siempre este componente para nuevos modales.
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  // Escape cierra (los popovers abiertos frenan la tecla antes de llegar
  // aquí: primero se cierra el popover, luego el modal) y el fondo no
  // desplaza mientras el modal esté abierto.
  useEffect(() => {
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previo
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
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

        <div className="overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</div>
        )}
      </div>
    </div>
  )
}
