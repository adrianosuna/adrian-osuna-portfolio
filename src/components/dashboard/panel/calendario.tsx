'use client'

// Calendario mensual con todo lo que tiene fecha: tareas (se crean y editan aquí),
// cargos recurrentes y seguimientos (solo enlazan a su módulo).
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Repeat, Wrench } from 'lucide-react'
import { cn, cuenta } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { DIAS, MESES, diaCorto, sumarDias, sumarMeses } from '@/lib/fechas'
import {
  eventosDelMes, porDia, semanasDelMes,
  type Evento, type RecurrenteCal, type SeguimientoCal, type TareaCal, type TipoEvento,
} from '@/lib/calendario'

/** La semana empieza en lunes. Nombre completo en la cabecera; en móvil, tres
 *  letras (la inicial rotulaba dos columnas con la misma M). */
const ORDEN = [1, 2, 3, 4, 5, 6, 0] as const
const CABECERA = ORDEN.map((i) => ({ largo: DIAS[i], corto: diaCorto(i) }))

const ESTILO: Record<TipoEvento, { punto: string; chip: string; Icono: typeof Wrench; nombre: string }> = {
  mantenimiento: { punto: 'bg-primary', chip: 'bg-primary/10 text-primary', Icono: Wrench, nombre: 'Mantenimiento' },
  seguimiento: { punto: 'bg-viajes', chip: 'bg-viajes-bg text-viajes', Icono: CalendarClock, nombre: 'Seguimiento' },
  recurrente: { punto: 'bg-warning', chip: 'bg-warning/10 text-warning', Icono: Repeat, nombre: 'Recurrente' },
}

/** Eventos que caben en una celda antes de resumir: títulos en escritorio y puntos
 *  en móvil, así que no es la misma cifra. */
const POR_CELDA = 3
const PUNTOS_MOVIL = 4

const flecha =
  'rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary hover:text-primary max-sm:p-2'

/** "Sábado, 5 de septiembre de 2026". */
function fechaLarga(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dia = DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${dia}, ${d} de ${MESES[m - 1].toLowerCase()} de ${y}`
}

function Celda({
  celda, hoy, eventos, abierto, foco, onDia, onNueva, onOtroMes,
}: {
  celda: { fecha: string; delMes: boolean }
  hoy: string
  eventos: Evento[]
  abierto: boolean
  /** La única celda que entra en el orden de tabulación (ver `Calendario`). */
  foco: boolean
  onDia: () => void
  onNueva: () => void
  onOtroMes: () => void
}) {
  const esHoy = celda.fecha === hoy
  const visibles = eventos.slice(0, POR_CELDA)
  const resto = eventos.length - visibles.length
  // Un día vecino nunca trae eventos (`eventosDelMes` acota al mes): lleva a su mes
  // en vez de dar de alta ahí.
  const accion = !celda.delMes ? onOtroMes : eventos.length === 0 ? onNueva : onDia

  return (
    <button
      type="button"
      data-fecha={celda.fecha}
      tabIndex={foco ? 0 : -1}
      // El día completo en el nombre accesible: el número suelto no sitúa, y
      // aquí es lo único que distingue una celda de la siguiente.
      aria-label={`${fechaLarga(celda.fecha)}${
        !celda.delMes
          ? ', ir a ese mes'
          : eventos.length
            ? `, ${cuenta(eventos.length, 'evento', 'eventos')}`
            : ', sin eventos'
      }`}
      // Solo es conmutador cuando abre y cierra el detalle: en una celda vacía o vecina
      // el clic hace otra cosa.
      aria-pressed={celda.delMes && eventos.length > 0 ? abierto : undefined}
      className={cn(
        // `flex flex-col` para que el número quede siempre arriba a la izquierda: un
        // <button> centra su contenido en vertical. Más baja en móvil, sin títulos.
        'flex min-h-14 flex-col border-r border-white/8 p-1.5 text-left transition-colors last:border-0 hover:bg-white/6 sm:min-h-24',
        !celda.delMes && 'bg-white/2',
        abierto && 'bg-muted/60',
      )}
      onClick={accion}>
      <span
        className={cn(
          'inline-flex size-5 items-center justify-center rounded-full text-[12px] tabular-nums',
          // Sin opacidad: sobre `muted-foreground` baja de 4,5:1 (ver CLAUDE.md).
          !celda.delMes && 'text-muted-foreground',
          esHoy && 'bg-primary font-semibold text-primary-foreground',
        )}>
        {Number(celda.fecha.slice(8, 10))}
      </span>
      {/* En móvil solo puntos: a 375 px la columna mide 47 px y los títulos quedaban
          recortados. El día se lee entero en el panel de detalle. */}
      <span className="mt-1 flex flex-wrap gap-1 sm:hidden">
        {eventos.slice(0, PUNTOS_MOVIL).map((e) => (
          <span
            key={e.uuid}
            className={cn('size-1.5 rounded-full', e.atrasado ? 'bg-danger' : ESTILO[e.tipo].punto)}
            aria-hidden
          />
        ))}
        {eventos.length > PUNTOS_MOVIL && (
          <span className="text-[10px] font-semibold leading-none text-primary">
            +{eventos.length - PUNTOS_MOVIL}
          </span>
        )}
      </span>

      <span className="mt-1 hidden flex-col gap-0.5 sm:flex">
        {visibles.map((e) => (
          <span key={e.uuid} className="flex items-center gap-1">
            <span
              className={cn('size-1.5 shrink-0 rounded-full', e.atrasado ? 'bg-danger' : ESTILO[e.tipo].punto)}
              aria-hidden
            />
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[11px] leading-tight',
                e.atrasado ? 'font-semibold text-danger' : 'text-muted-foreground',
              )}>
              {e.titulo}
            </span>
          </span>
        ))}
        {resto > 0 && <span className="pl-2.5 text-[11px] font-semibold text-primary">+{resto} más</span>}
      </span>
    </button>
  )
}

export function Calendario({
  hoy, tareas, recurrentes, seguimientos, onNuevaTarea, onAbrirTarea, onAbrirEvento,
}: {
  hoy: string
  tareas: TareaCal[]
  recurrentes: RecurrenteCal[]
  seguimientos: SeguimientoCal[]
  /** Pulsar un día vacío: da de alta una tarea con esa fecha. */
  onNuevaTarea: (fecha: string) => void
  /** Pulsar una tarea: la abre para editar. */
  onAbrirTarea: (uuid: string) => void
  /** Pulsar un recurrente o un seguimiento: lleva a su módulo. */
  onAbrirEvento: (e: Evento) => void
}) {
  const [mes, setMes] = useState(hoy.slice(0, 7))
  const [tipos, setTipos] = useState<Set<TipoEvento>>(
    () => new Set<TipoEvento>(['mantenimiento', 'recurrente', 'seguimiento']),
  )
  /** Día abierto en el panel de detalle (en una celda no cabe todo). */
  const [dia, setDia] = useState<string | null>(null)

  const todos = useMemo(
    () => eventosDelMes(mes, hoy, { tareas, recurrentes, seguimientos }),
    [mes, hoy, tareas, recurrentes, seguimientos],
  )
  const eventos = useMemo(() => todos.filter((e) => tipos.has(e.tipo)), [todos, tipos])
  const mapa = useMemo(() => porDia(eventos), [eventos])
  const semanas = useMemo(() => semanasDelMes(mes), [mes])

  const [y, m] = mes.split('-').map(Number)
  const irA = (delta: number) => {
    setMes(sumarMeses(`${mes}-01`, delta).slice(0, 7))
    setDia(null)
  }

  // Teclado: una sola parada de tabulador (hoy o el 1) y flechas para moverse; Inicio/
  // Fin a los extremos de la semana, RePág/AvPág al mes. Sin role="grid": son botones.
  const rejilla = useRef<HTMLDivElement>(null)
  const detalle = useRef<HTMLDivElement>(null)
  /** Día al que hay que devolver el foco tras cambiar de mes. */
  const pendiente = useRef<string | null>(null)
  const enElMes = hoy.slice(0, 7) === mes
  const tabStop = enElMes ? hoy : `${mes}-01`

  /** Cambia de mes y deja el foco pedido para cuando esté pintado. */
  const irAlMesDe = (fecha: string) => {
    setMes(fecha.slice(0, 7))
    setDia(null)
    pendiente.current = fecha
  }
  const enfocar = (fecha: string) => {
    rejilla.current?.querySelector<HTMLButtonElement>(`[data-fecha="${fecha}"]`)?.focus()
  }

  const teclas = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const origen = (e.target as HTMLElement).closest<HTMLElement>('[data-fecha]')?.dataset.fecha
    if (!origen) return
    const salto: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
    }
    // Columna dentro de su semana, contando desde el lunes: es lo que
    // Inicio/Fin necesitan para ir a los extremos de la fila.
    const columna = (new Date(`${origen}T00:00:00Z`).getUTCDay() + 6) % 7
    let destino: string | null = null
    if (e.key in salto) destino = sumarDias(origen, salto[e.key])
    else if (e.key === 'Home') destino = sumarDias(origen, -columna)
    else if (e.key === 'End') destino = sumarDias(origen, 6 - columna)
    else if (e.key === 'PageUp') destino = sumarMeses(origen, -1)
    else if (e.key === 'PageDown') destino = sumarMeses(origen, 1)
    if (!destino) return
    e.preventDefault()
    // Si el destino cae en otro mes se cambia de mes, y el efecto de abajo le
    // pone el foco cuando su botón exista.
    if (destino.slice(0, 7) !== mes) irAlMesDe(destino)
    else enfocar(destino)
  }

  // El foco se pone DESPUÉS de pintar el mes nuevo: al saltar de mes con una
  // flecha, el botón de destino todavía no existe cuando se pulsa la tecla.
  useEffect(() => {
    const f = pendiente.current
    if (!f) return
    pendiente.current = null
    rejilla.current?.querySelector<HTMLButtonElement>(`[data-fecha="${f}"]`)?.focus()
  }, [mes])

  // El detalle se trae a la vista al abrirlo: en móvil nacía fuera de pantalla y
  // tocar un día parecía no hacer nada. `nearest` no mueve nada si ya se ve.
  useEffect(() => {
    if (!dia || !detalle.current) return
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    detalle.current.scrollIntoView({ block: 'nearest', behavior: quieto ? 'auto' : 'smooth' })
  }, [dia])

  const alternar = (t: TipoEvento) =>
    setTipos((s) => {
      const n = new Set(s)
      // Nunca se apagan las tres: un calendario vacío no informa de nada.
      if (n.has(t) && n.size > 1) n.delete(t)
      else n.add(t)
      return n
    })

  // `cuentaTipo` y no `cuenta`: ese nombre ya es el del plural de `utils`.
  const cuentaTipo = (t: TipoEvento) => todos.filter((e) => e.tipo === t).length
  const delDia = dia ? (mapa.get(dia) ?? []) : []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Tooltip texto="Mes anterior">
            <button type="button" className={flecha} aria-label="Mes anterior" onClick={() => irA(-1)}>
              <ChevronLeft className="size-4" />
            </button>
          </Tooltip>
          <span className="min-w-40 text-center text-sm font-semibold">
            {MESES[m - 1]} {y}
          </span>
          <Tooltip texto="Mes siguiente">
            <button type="button" className={flecha} aria-label="Mes siguiente" onClick={() => irA(1)}>
              <ChevronRight className="size-4" />
            </button>
          </Tooltip>
        </div>
        {mes !== hoy.slice(0, 7) && (
          <button
            type="button"
            className="rounded-md border border-border px-2.5 py-1 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary max-sm:py-2"
            onClick={() => {
              setMes(hoy.slice(0, 7))
              setDia(null)
            }}>
            Hoy
          </button>
        )}

        {/* Filtros por tipo con la cuenta del mes: son tres fuentes distintas
            y en un mes cargado conviene poder aislar una. */}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {(Object.keys(ESTILO) as TipoEvento[]).map((t) => {
            const { punto, nombre, Icono } = ESTILO[t]
            const activo = tipos.has(t)
            return (
              <button
                key={t}
                type="button"
                aria-pressed={activo}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-semibold transition-colors max-sm:py-2',
                  activo
                    ? 'border-white/12 bg-white/6 text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
                onClick={() => alternar(t)}>
                <span className={cn('size-2 rounded-full', activo ? punto : 'bg-muted')} aria-hidden />
                <Icono className="size-3 max-sm:hidden" aria-hidden />
                {nombre}
                <span className="tabular-nums text-muted-foreground">{cuentaTipo(t)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Cada celda es un botón: un día vacío da de alta una tarea en esa fecha y uno
          con eventos abre su detalle. */}
      <div ref={rejilla} onKeyDown={teclas} className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-7 border-b border-white/8 bg-white/4">
          {/* El nombre largo va en el DOM con sr-only, no en aria-label del div: en un div
              sin rol ese atributo no existe. */}
          {CABECERA.map((d) => (
            <div
              key={d.largo}
              className="px-1 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="sm:hidden" aria-hidden>{d.corto}</span>
              <span className="sr-only sm:not-sr-only">{d.largo}</span>
            </div>
          ))}
        </div>
        {semanas.map((semana, i) => (
          <div key={i} className="grid grid-cols-7 border-b border-white/8 last:border-0">
            {semana.map((celda) => (
              <Celda
                key={celda.fecha}
                celda={celda}
                hoy={hoy}
                eventos={mapa.get(celda.fecha) ?? []}
                abierto={dia === celda.fecha}
                foco={celda.fecha === tabStop}
                onDia={() => setDia(dia === celda.fecha ? null : celda.fecha)}
                onNueva={() => onNuevaTarea(celda.fecha)}
                onOtroMes={() => irAlMesDe(celda.fecha)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Detalle del día: en una celda de 100 px no caben tres títulos con su
          tipo, así que el día pulsado se despliega aquí. */}
      {dia && (
        <div ref={detalle} className="superficie rounded-2xl p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            {/* h2 y no h3: va bajo el h1 de la página sin nada en medio. */}
            <h2 className="text-sm font-semibold">{fechaLarga(dia)}</h2>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/10 max-sm:py-2"
              onClick={() => onNuevaTarea(dia)}>
              <Plus className="size-3.5" />
              Nueva tarea aquí
            </button>
          </div>
          {delDia.length === 0 ? (
            <p className="py-1 text-[13px] text-muted-foreground">
              Nada previsto. Con «Nueva tarea aquí» das de alta un mantenimiento en este día.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {delDia.map((e) => {
                const { chip, Icono, nombre } = ESTILO[e.tipo]
                return (
                  <li key={e.uuid}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2.5 py-2 text-left transition-colors hover:bg-white/6"
                      onClick={() =>
                        e.tipo === 'mantenimiento' ? onAbrirTarea(e.refUuid) : onAbrirEvento(e)
                      }>
                      <span className={cn('mt-0.5 shrink-0 rounded-md p-1', chip)}>
                        <Icono className="size-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="text-[13.5px] font-semibold">{e.titulo}</span>
                          {e.atrasado && (
                            <span className="rounded-md bg-danger-bg px-1.5 py-0.5 text-[11px] font-semibold text-danger">
                              Vencido
                            </span>
                          )}
                        </span>
                        <span className="block text-[12px] text-muted-foreground">
                          {nombre}
                          {e.detalle && ` · ${e.detalle}`}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
