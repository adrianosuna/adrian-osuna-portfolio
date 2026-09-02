'use client'

// Acciones de una fila: iconos en escritorio, menú de tres puntos en móvil.
//
// El problema: en una fila con tres o cuatro acciones (editar, dividir,
// eliminar…) los iconos se comen el ancho del móvil, empujan el concepto y el
// importe, y quedan tan juntos que se pulsa el de al lado. En escritorio, en
// cambio, tenerlos a la vista es lo cómodo: se ve todo y se acierta con el ratón.
//
// Así que se declaran UNA vez y el componente decide cómo pintarlos:
//
//   · **≥ sm** — los iconos en línea, como siempre.
//   · **< sm** — un solo botón «⋯» que abre un menú con las acciones POR SU
//     NOMBRE. En móvil el texto gana al icono: no hay `title` que enseñar al
//     pasar el dedo por encima, así que un icono suelto es una adivinanza.
//
// Con pocas acciones (menos de `desde`) no hay menú en ninguna parte: dos
// iconos caben de sobra, y esconderlos detrás de un menú serían dos toques
// donde había uno.
//
// El popover se reutiliza de `ui/fields.tsx` (portal con posición fija): así no
// lo recorta ninguna tabla con overflow ni el cuerpo de un modal, y hereda el
// cierre con Escape, con clic fuera y al hacer scroll.
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PopoverPanel, usePopover } from '@/components/ui/fields'
import { btnIcon } from '@/components/ui/botones'

export interface AccionFila {
  /** Clave de React y del elemento del menú. */
  id: string
  /** Nombre de la acción: el texto del menú y el nombre accesible del icono. */
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  /** Por qué no se puede (sale como `title` y como apoyo dentro del menú). */
  motivo?: string
  /** Pinta la acción en rojo: borrados y equivalentes. */
  destructiva?: boolean
}

export function MenuAcciones({
  acciones,
  etiqueta,
  desde = 3,
  className,
}: {
  acciones: AccionFila[]
  /** De qué fila son, para el nombre accesible del botón «⋯». */
  etiqueta: string
  /** Nº de acciones a partir del cual el móvil usa el menú. */
  desde?: number
  className?: string
}) {
  const { open, setOpen, ref, popRef } = usePopover()
  const conMenu = acciones.length >= desde

  const iconos = (
    <span className="flex items-center justify-end gap-0.5">
      {acciones.map((a) => (
        <button
          key={a.id}
          type="button"
          className={cn(btnIcon, a.destructiva && 'hover:bg-danger-bg hover:text-danger')}
          aria-label={a.label}
          title={a.disabled && a.motivo ? a.motivo : a.label}
          disabled={a.disabled}
          onClick={a.onClick}>
          {a.icon}
        </button>
      ))}
    </span>
  )

  // Sin menú: los iconos, y se acabó.
  if (!conMenu) return <span className={className}>{iconos}</span>

  return (
    <span className={cn('flex items-center justify-end', className)}>
      {/* Escritorio */}
      <span className="hidden sm:flex">{iconos}</span>

      {/* Móvil */}
      <span ref={ref} className="sm:hidden">
        <button
          type="button"
          className={btnIcon}
          aria-label={`Acciones de ${etiqueta}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}>
          <MoreHorizontal className="size-4" />
        </button>
        {open && (
          <PopoverPanel
            anclaRef={ref}
            popRef={popRef}
            rol="menu"
            etiqueta={`Acciones de ${etiqueta}`}
                        // `bg-popover` y NO `bg-card`: las tarjetas del proyecto son
            // translúcidas a propósito (`--card` es un blanco al 4 %), y un
            // panel flotante con ese fondo deja ver la lista de debajo. Es el
            // token que ya usan el modal y los popovers de `fields.tsx`.
            className="min-w-52 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg">
            {acciones.map((a) => (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                // 40 px de alto: es el criterio táctil del proyecto.
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors',
                  a.disabled
                    ? 'cursor-not-allowed opacity-50'
                    : a.destructiva
                      ? 'text-danger hover:bg-danger-bg'
                      : 'hover:bg-muted',
                )}
                disabled={a.disabled}
                onClick={() => {
                  setOpen(false)
                  a.onClick()
                }}>
                <span className="shrink-0 text-muted-foreground">{a.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate">{a.label}</span>
                  {/* El motivo, solo cuando explica una acción apagada: en el
                      menú hay sitio para decirlo, y en un icono no. */}
                  {a.disabled && a.motivo && (
                    <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                      {a.motivo}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </PopoverPanel>
        )}
      </span>
    </span>
  )
}
