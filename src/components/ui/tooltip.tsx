'use client'

// Tooltip propio en lugar del `title` nativo. Envuelve un elemento con `cloneElement`
// (el DOM no cambia); `envuelto` para botones disabled, que no reciben el ratón.
import {
  Children, cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef,
  useState, type ReactElement, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/** Espera antes de abrir al pasar el ratón: al enfocar con el teclado, ninguna. */
const RETARDO_MS = 350

/** Solo un tooltip visible a la vez: con ratón sobre un icono y Tab al siguiente,
 *  el primero no recibe mouseleave y se quedaba abierto. */
let cerrarActivo: (() => void) | null = null
const registrar = (cerrar: () => void) => {
  if (cerrarActivo && cerrarActivo !== cerrar) cerrarActivo()
  cerrarActivo = cerrar
}
const desregistrar = (cerrar: () => void) => {
  if (cerrarActivo === cerrar) cerrarActivo = null
}

type Manejadores = {
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
  onFocus?: (e: React.FocusEvent) => void
  onBlur?: (e: React.FocusEvent) => void
  onPointerDown?: (e: React.PointerEvent) => void
  'aria-describedby'?: string
  className?: string
}

export function Tooltip({
  texto, children, envuelto = false, className,
}: {
  /** Vacío o null: no hay tooltip y el hijo se devuelve tal cual. */
  texto: ReactNode
  children: ReactElement<Manejadores>
  /** Rodea al hijo con un `span` que recibe el ratón (para hijos `disabled`). */
  envuelto?: boolean
  /** Clases del `span` envoltorio (solo con `envuelto`). */
  className?: string
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const ancla = useRef<HTMLElement | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelar = () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
  }
  // Estable entre renders: el registro de "solo uno visible" guarda esta
  // función, así que tiene que ser siempre la misma.
  const cerrar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
    setVisible(false)
    desregistrar(cerrarRef.current)
  }, [])
  const cerrarRef = useRef(cerrar)

  const mostrar = () => {
    registrar(cerrar)
    setVisible(true)
  }
  const abrir = (el: HTMLElement, inmediato: boolean) => {
    ancla.current = el
    cancelar()
    if (inmediato) mostrar()
    else temporizador.current = setTimeout(mostrar, RETARDO_MS)
  }

  // Al desmontarse (una fila que se va con el cursor encima) no puede quedar
  // ni el temporizador ni el registro apuntando aquí.
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current)
      desregistrar(cerrarRef.current)
    },
    [],
  )
  // Escape cierra (sin robárselo a nadie: solo mientras está visible).
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visible])

  const hijo = Children.only(children)
  if (!isValidElement(hijo)) return children
  if (texto === null || texto === undefined || texto === '' || texto === false) return children

  const manejadores: Manejadores = {
    onMouseEnter: (e) => abrir(e.currentTarget as HTMLElement, false),
    onMouseLeave: cerrar,
    onFocus: (e) => abrir(e.currentTarget as HTMLElement, true),
    onBlur: cerrar,
    // Al pulsar se cierra: el botón conserva el foco tras el clic y el globo quedaba
    // colgado. Salvo `envuelto`: el hijo está apagado y el tooltip es la explicación.
    ...(envuelto ? {} : { onPointerDown: cerrar }),
  }

  const globo = visible && <Globo id={id} ancla={ancla} texto={texto} />

  if (envuelto) {
    return (
      <>
        <span
          className={cn('inline-flex', className)}
          aria-describedby={visible ? id : undefined}
          {...manejadores}>
          {cloneElement(hijo, { className: cn(hijo.props.className, 'pointer-events-none') })}
        </span>
        {globo}
      </>
    )
  }

  // Se encadenan los manejadores que el hijo ya tuviera: el tooltip no se
  // los quita.
  const previos = hijo.props
  const extra: Manejadores = {
    'aria-describedby': visible ? id : previos['aria-describedby'],
    onMouseEnter: (e) => {
      previos.onMouseEnter?.(e)
      manejadores.onMouseEnter?.(e)
    },
    onMouseLeave: (e) => {
      previos.onMouseLeave?.(e)
      cerrar()
    },
    onFocus: (e) => {
      previos.onFocus?.(e)
      manejadores.onFocus?.(e)
    },
    onBlur: (e) => {
      previos.onBlur?.(e)
      cerrar()
    },
    onPointerDown: (e) => {
      previos.onPointerDown?.(e)
      cerrar()
    },
  }
  // Sin lectura de `.current`: solo se añaden manejadores al hijo clonado.
  // eslint-disable-next-line react-hooks/refs
  const clon = cloneElement(hijo, extra)

  return (
    <>
      {clon}
      {globo}
    </>
  )
}

/** El globo, en un portal con `position: fixed`: no lo recorta ningún overflow.
 *  Centrado sobre el ancla, debajo si arriba no cabe, siempre en el viewport. */
function Globo({ id, ancla, texto }: {
  id: string
  ancla: React.RefObject<HTMLElement | null>
  texto: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const a = ancla.current
    if (!el || !a) return
    const r = a.getBoundingClientRect()
    const w = el.offsetWidth
    const h = el.offsetHeight
    const arriba = r.top - h - 6
    const top = arriba >= 8 ? arriba : r.bottom + 6
    const centro = r.left + r.width / 2 - w / 2
    const left = Math.min(Math.max(8, centro), Math.max(8, window.innerWidth - w - 8))
    setPos({ top, left })
  }, [ancla])

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      style={{ position: 'fixed', zIndex: 60, ...(pos ?? { top: 0, left: 0, visibility: 'hidden' }) }}
      className="pointer-events-none max-w-64 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[12px] leading-snug text-foreground shadow-lg">
      {texto}
    </div>,
    document.body,
  )
}
