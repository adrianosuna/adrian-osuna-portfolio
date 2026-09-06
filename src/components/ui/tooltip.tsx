'use client'

// Tooltip propio para sustituir al `title` nativo del navegador, que sale gris,
// tarde y con la tipografía del sistema — y en el dashboard había decenas:
// los iconos de acción de cada fila, los puntos de color de categoría, las
// fechas de vencimiento, los textos recortados...
//
// Mismo aspecto que el tooltip de las gráficas (`ui/charts/tooltip.ts`): son
// dos piezas distintas a propósito —aquel construye HTML con filas y colores y
// lo inyecta; este es React puro con un texto—, pero se tienen que ver igual.
//
// Cómo se usa: envuelve UN elemento y le engancha los eventos con
// `cloneElement`, así el DOM no cambia (nada de spans extra que rompan un
// `truncate` o una fila flex). El hijo tiene que ser un elemento del DOM o un
// componente que reenvíe `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur`.
//
// ⚠ Un botón `disabled` NO recibe eventos de ratón (Chrome se los traga, y el
// padre tampoco los ve). Para esos, `envuelto`: el tooltip pone un `span`
// alrededor que sí los recibe y deja al hijo con `pointer-events-none`. Es lo
// que usa `MenuAcciones` para explicar POR QUÉ una acción está apagada.
//
// Accesibilidad: se abre también con el foco (teclado), se cierra con Escape y
// mientras está visible el hijo lo referencia con `aria-describedby`. El
// nombre accesible sigue siendo el `aria-label` del hijo: el tooltip describe,
// no nombra.
import {
  Children, cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef,
  useState, type ReactElement, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/** Espera antes de abrir al pasar el ratón: al enfocar con el teclado, ninguna. */
const RETARDO_MS = 350

/**
 * Solo UN tooltip visible a la vez, con un registro de módulo.
 *
 * ⚠ Sin esto salen dos globos a la vez en un caso muy real: el ratón sobre un
 * icono y Tab al siguiente. El primero no recibe `mouseleave` —el ratón no se
 * ha movido— así que se queda abierto mientras el foco abre el otro.
 */
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
    // ⚠ Al PULSAR se cierra. Si no, el botón se queda con el foco tras el
    // clic y el globo permanece colgado en pantalla aunque el ratón ya se
    // haya ido — que es exactamente lo que parece un fallo.
    //
    // Salvo `envuelto`: ahí el hijo está APAGADO, el clic no hace nada y el
    // tooltip es justo la explicación de por qué. Quitarla al pulsarlo sería
    // esconder la respuesta a la pregunta que se acaba de hacer.
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
  // `react-hooks/refs` marca este cloneElement como "leer un ref en el render"
  // porque el hijo es un elemento arbitrario que PODRÍA traer uno. Aquí no se
  // lee ningún `.current`: solo se añaden manejadores y aria-describedby.
  // eslint-disable-next-line react-hooks/refs
  const clon = cloneElement(hijo, extra)

  return (
    <>
      {clon}
      {globo}
    </>
  )
}

/**
 * El globo, en un portal con `position: fixed`: nunca lo recorta una tabla
 * con overflow ni el cuerpo de un modal. Centrado sobre el ancla; si arriba
 * no cabe, debajo; y siempre dentro del viewport.
 */
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
