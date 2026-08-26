'use client'

// Campos de formulario custom del dashboard (sustituyen a los controles
// nativos, que desentonan con el tema): número sin spinners, select con
// popover propio y selector de fecha con calendario. Reutilizables en
// cualquier módulo; estilados con los tokens del tema activo.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Estilo base compartido (text-base en móvil: <16px provoca zoom en iOS Safari).
const fieldClass =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-base outline-none transition-colors focus:border-primary sm:text-sm'

// Popover: cierre al hacer clic fuera (del ancla y del panel), con Escape
// (en captura y frenando la propagación: que no cierre también el modal que
// lo contiene) o al hacer scroll/resize fuera del panel.
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null) // contenedor del disparador (ancla)
  const popRef = useRef<HTMLDivElement>(null) // panel, portalizado en <body>
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
    }
    const onScroll = (e: Event) => {
      // El panel está en posición fija: si el fondo hace scroll, se cierra en
      // vez de quedarse flotando desubicado. Su scroll interno no cierra.
      if (popRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])
  return { open, setOpen, ref, popRef }
}

// Panel del popover en un portal (position:fixed sobre <body>): no lo recorta
// ningún contenedor con overflow — los modales con scroll incluidos. Se coloca
// bajo el ancla (o encima si abajo no cabe) y se recalcula tras cada render
// (el alto varía, p. ej. al cambiar de mes en el calendario).
function PopoverPanel({
  anclaRef, popRef, mismaAnchura = false, rol, etiqueta, className, children,
}: {
  anclaRef: React.RefObject<HTMLDivElement | null>
  popRef: React.RefObject<HTMLDivElement | null>
  /** El panel toma la anchura del ancla (selects). */
  mismaAnchura?: boolean
  rol?: string
  etiqueta?: string
  className?: string
  children: React.ReactNode
}) {
  const [pos, setPos] = useState<{ top: number; left: number; width?: number } | null>(null)

  useLayoutEffect(() => {
    const pop = popRef.current
    if (!pop) return
    const colocar = () => {
      const ancla = anclaRef.current
      if (!ancla) return
      const r = ancla.getBoundingClientRect()
      const alto = pop.offsetHeight
      const ancho = mismaAnchura ? r.width : pop.offsetWidth
      const cabeAbajo = r.bottom + 4 + alto <= window.innerHeight - 8
      const nuevo = {
        top: Math.max(8, cabeAbajo ? r.bottom + 4 : r.top - alto - 4),
        left: Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - ancho - 8)),
        width: mismaAnchura ? r.width : undefined,
      }
      setPos((p) =>
        p && p.top === nuevo.top && p.left === nuevo.left && p.width === nuevo.width ? p : nuevo,
      )
    }
    colocar()
    // Recolocación si cambia el alto del contenido (p. ej. otro mes del
    // calendario con más semanas). Sin ResizeObserver (jsdom) basta la inicial.
    if (typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(colocar)
    observador.observe(pop)
    return () => observador.disconnect()
  }, [anclaRef, popRef, mismaAnchura])

  return createPortal(
    <div
      ref={popRef}
      role={rol}
      aria-label={etiqueta}
      // Oculto hasta medirlo y colocarlo (primer render); por encima del modal (z-50).
      style={{ position: 'fixed', zIndex: 60, ...(pos ?? { top: 0, left: 0, visibility: 'hidden' }) }}
      className={className}>
      {children}
    </div>,
    document.body,
  )
}

// ─────────── TextField: entrada de texto ───────────

export function TextField({
  value, onChange, placeholder, autoFocus, onEnter, className, ariaLabel, type = 'text', maxLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  onEnter?: () => void
  className?: string
  ariaLabel?: string
  /** 'text' | 'email' | 'url' … (tipos de texto; para números, NumberField) */
  type?: string
  maxLength?: number
}) {
  return (
    <input
      type={type}
      className={cn(fieldClass, className)}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
    />
  )
}

// ─────────── TextareaField: texto multilínea ───────────

export function TextareaField({
  value, onChange, placeholder, className, ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  return (
    <textarea
      className={cn(fieldClass, 'min-h-20 resize-y', className)}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// ─────────── NumberField: entrada numérica sin spinners ───────────
// Input de texto con teclado numérico; admite coma o punto decimal.
// value null = vacío. No admite negativos (importes).

const parseNum = (texto: string): number | null => {
  const limpio = texto.replace(',', '.')
  if (limpio === '' || limpio === '.') return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

export function NumberField({
  value, onChange, placeholder = '—', autoFocus, onEnter, className, ariaLabel,
  step = 1, compact = false,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  autoFocus?: boolean
  onEnter?: () => void
  /** Clases del contenedor (anchos, flex...); el padding lo gestiona `compact`. */
  className?: string
  ariaLabel?: string
  /** Incremento de las flechas (botones y teclado ↑/↓). */
  step?: number
  /** Variante baja para celdas de tabla. */
  compact?: boolean
}) {
  const [texto, setTexto] = useState(value === null ? '' : String(value))
  // Sincroniza el texto cuando el valor cambia desde fuera (reset del borrador,
  // flechas, datos nuevos del servidor...), sin pisar lo que se está tecleando.
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    if (parseNum(texto) !== value) setTexto(value === null ? '' : String(value))
  }

  // Incremento/decremento con redondeo a céntimos y suelo en 0.
  const aplicar = (delta: 1 | -1) => {
    const nuevo = Math.max(0, Math.round(((value ?? 0) + delta * step) * 100) / 100)
    onChange(nuevo)
  }

  const flecha =
    'flex h-3.5 items-center rounded-sm px-0.5 text-muted-foreground/60 transition-colors hover:text-foreground'

  return (
    <div
      className={cn(
        'flex items-stretch rounded-md border border-input bg-background transition-colors focus-within:border-primary',
        className,
      )}>
      <input
        type="text"
        inputMode="decimal"
        className={cn(
          'w-full min-w-0 bg-transparent px-2.5 text-base outline-none placeholder:text-muted-foreground sm:text-sm',
          compact ? 'py-1' : 'py-1.5',
        )}
        value={texto}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        onChange={(e) => {
          // Solo dígitos y un separador decimal (coma o punto).
          let limpio = e.target.value.replace(/[^\d.,]/g, '')
          const primerSep = limpio.search(/[.,]/)
          if (primerSep !== -1) {
            limpio =
              limpio.slice(0, primerSep + 1) + limpio.slice(primerSep + 1).replace(/[.,]/g, '')
          }
          setTexto(limpio)
          onChange(parseNum(limpio))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter?.()
          else if (e.key === 'ArrowUp') { e.preventDefault(); aplicar(1) }
          else if (e.key === 'ArrowDown') { e.preventDefault(); aplicar(-1) }
        }}
      />
      {/* Flechas minimalistas (fuera del orden de tabulación: el teclado ya
          incrementa con ↑/↓ sobre el propio input) */}
      <div className="flex flex-col justify-center pr-1">
        <button type="button" tabIndex={-1} className={flecha} aria-label="Incrementar" onClick={() => aplicar(1)}>
          <ChevronUp className="size-3" />
        </button>
        <button type="button" tabIndex={-1} className={flecha} aria-label="Decrementar" onClick={() => aplicar(-1)}>
          <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
  )
}

// ─────────── SelectField: desplegable con popover propio ───────────

export interface SelectOption {
  value: string
  label: string
}

export function SelectField({
  value, onChange, options, placeholder = '—', className, ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  const { open, setOpen, ref, popRef } = usePopover()
  const actual = options.find((o) => o.value === value)

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        className={cn(fieldClass, 'flex items-center justify-between gap-2 text-left')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}>
        <span className={cn('truncate', !actual && 'text-muted-foreground')}>
          {actual?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <PopoverPanel
          anclaRef={ref}
          popRef={popRef}
          mismaAnchura
          rol="listbox"
          className="max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted',
                o.value === value ? 'font-semibold text-primary' : 'text-foreground',
              )}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}>
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check className="size-3.5 shrink-0" />}
            </button>
          ))}
        </PopoverPanel>
      )}
    </div>
  )
}

// ─────────── DateField: selector de fecha con calendario propio ───────────
// value en formato 'YYYY-MM-DD' o '' (vacío). Semana empezando en lunes.

const MESES_CAL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_CAL = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export function DateField({
  value, onChange, placeholder = '—', className, ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  const { open, setOpen, ref, popRef } = usePopover()
  const hoy = new Date()
  const seleccion = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
  const base = seleccion ? new Date(`${seleccion}T00:00:00`) : hoy
  const [vista, setVista] = useState({ y: base.getFullYear(), m: base.getMonth() })

  const abrir = () => {
    // Al abrir, centra la vista en la fecha seleccionada (o en hoy).
    const b = seleccion ? new Date(`${seleccion}T00:00:00`) : new Date()
    setVista({ y: b.getFullYear(), m: b.getMonth() })
    setOpen((o) => !o)
  }

  const mover = (delta: number) =>
    setVista((v) => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  // Rejilla del mes: huecos iniciales (semana empieza en lunes) + días.
  const primerDia = (new Date(vista.y, vista.m, 1).getDay() + 6) % 7
  const diasMes = new Date(vista.y, vista.m + 1, 0).getDate()
  const celdas: Array<number | null> = [
    ...Array.from({ length: primerDia }, () => null),
    ...Array.from({ length: diasMes }, (_, i) => i + 1),
  ]

  const fmt = (v: string) => v.split('-').reverse().join('/')

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        className={cn(fieldClass, 'flex items-center justify-between gap-2 text-left')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ?? 'Fecha'}
        onClick={abrir}>
        <span className={cn('truncate', !seleccion && 'text-muted-foreground')}>
          {seleccion ? fmt(seleccion) : placeholder}
        </span>
        <Calendar className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <PopoverPanel
          anclaRef={ref}
          popRef={popRef}
          rol="dialog"
          etiqueta="Calendario"
          className="w-64 rounded-lg border border-border bg-popover p-2.5 shadow-lg">
          <div className="mb-1.5 flex items-center justify-between">
            <button type="button" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Mes anterior" onClick={() => mover(-1)}>
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold">
              {MESES_CAL[vista.m]} {vista.y}
            </span>
            <button type="button" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Mes siguiente" onClick={() => mover(1)}>
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {DIAS_CAL.map((d) => (
              <span key={d} className="py-1 text-center text-[11px] font-semibold text-muted-foreground">
                {d}
              </span>
            ))}
            {celdas.map((dia, i) =>
              dia === null ? (
                <span key={`h${i}`} />
              ) : (
                <button
                  key={dia}
                  type="button"
                  className={cn(
                    'rounded-md py-1 text-center text-[13px] transition-colors hover:bg-muted',
                    seleccion === iso(vista.y, vista.m, dia) &&
                      'bg-primary font-semibold text-primary-foreground hover:bg-primary',
                    !seleccion &&
                      iso(vista.y, vista.m, dia) === iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) &&
                      'font-semibold text-primary',
                  )}
                  onClick={() => {
                    onChange(iso(vista.y, vista.m, dia))
                    setOpen(false)
                  }}>
                  {dia}
                </button>
              ),
            )}
          </div>

          <div className="mt-1.5 flex justify-between border-t border-border/60 pt-1.5">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-muted"
              onClick={() => {
                const h = new Date()
                onChange(iso(h.getFullYear(), h.getMonth(), h.getDate()))
                setOpen(false)
              }}>
              Hoy
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}>
              <X className="size-3" /> Borrar
            </button>
          </div>
        </PopoverPanel>
      )}
    </div>
  )
}
