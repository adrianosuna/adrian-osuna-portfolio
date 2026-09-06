'use client'

// Calendario del dashboard: la rejilla de un mes con TODO lo que tiene fecha
// —tareas de mantenimiento, cargos recurrentes y seguimientos del pipeline—,
// navegable mes a mes.
//
// Qué se puede hacer aquí y qué no, y por qué: las tareas de mantenimiento se
// CREAN y EDITAN desde el calendario (pulsando un día o un evento), porque son
// lo que de verdad se planifica por fecha. Un cargo recurrente o un
// seguimiento solo se consultan y enlazan a su módulo: sus formularios tienen
// reglas propias (periodicidad e importe, oportunidad y estado) y una segunda
// copia aquí es exactamente como se desincronizan.
//
// La rejilla es de DÍAS y no de meses porque es lo que se espera de un
// calendario y lo que permite pulsar una fecha para crear algo en ella. Hubo
// una vista de 12 meses en Mantenimiento, retirada el 05/09/2026: "lo del año
// no me gusta nada, prefiero solo meses".
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Repeat, Wrench } from 'lucide-react'
import { cn, cuenta } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { DIAS, MESES, diaCorto, sumarDias, sumarMeses } from '@/lib/fechas'
import {
  eventosDelMes, porDia, semanasDelMes,
  type Evento, type RecurrenteCal, type SeguimientoCal, type TareaCal, type TipoEvento,
} from '@/lib/calendario'

/**
 * La semana empieza en LUNES. La cabecera lleva el nombre COMPLETO («Lunes»,
 * «Martes»), que es como se lee un calendario; solo en móvil se abrevia a tres
 * letras, porque a 375 px la columna mide 47 px y «Miércoles» no cabe. La
 * inicial suelta, que es como estaba, rotulaba dos columnas con la misma M.
 */
const ORDEN = [1, 2, 3, 4, 5, 6, 0] as const
const CABECERA = ORDEN.map((i) => ({ largo: DIAS[i], corto: diaCorto(i) }))

const ESTILO: Record<TipoEvento, { punto: string; chip: string; Icono: typeof Wrench; nombre: string }> = {
  mantenimiento: { punto: 'bg-primary', chip: 'bg-primary/10 text-primary', Icono: Wrench, nombre: 'Mantenimiento' },
  seguimiento: { punto: 'bg-viajes', chip: 'bg-viajes-bg text-viajes', Icono: CalendarClock, nombre: 'Seguimiento' },
  recurrente: { punto: 'bg-warning', chip: 'bg-warning/10 text-warning', Icono: Repeat, nombre: 'Recurrente' },
}

/**
 * Cuántos eventos caben en una celda antes de resumir el resto: TÍTULOS en
 * escritorio y PUNTOS en móvil, así que no es la misma cifra — en 47 px de
 * ancho caben cuatro puntos y ningún título.
 */
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
  // ⚠ Un día VECINO nunca trae eventos: `eventosDelMes` acota al mes, así que
  // la celda del 31 de agosto sale vacía aunque ese día tenga algo. Por eso
  // lleva a SU mes en vez de dar de alta ahí: la celda no puede decir la
  // verdad sobre ese día, pero sí llevar a donde se ve.
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
      // Solo es un conmutador cuando de verdad abre y cierra el detalle: en una
      // celda vacía o vecina el clic hace otra cosa y anunciarla como "no
      // pulsado" sería mentir.
      aria-pressed={celda.delMes && eventos.length > 0 ? abierto : undefined}
      className={cn(
        // ⚠ `flex flex-col` para que el NÚMERO quede arriba a la izquierda
        // SIEMPRE. Un <button> centra su contenido en vertical, así que el
        // número bailaba entre los 9 px de un día cargado y los 41 px de uno
        // vacío: en una rejilla de 35 celdas, cada fila a una altura distinta.
        // Más baja en móvil: sin títulos no hace falta tanto alto, y así entra
        // el mes entero sin scroll.
        'flex min-h-14 flex-col border-r border-border/60 p-1.5 text-left transition-colors last:border-0 hover:bg-muted/40 sm:min-h-24',
        !celda.delMes && 'bg-card/30',
        abierto && 'bg-muted/60',
      )}
      onClick={accion}>
      <span
        className={cn(
          'inline-flex size-5 items-center justify-center rounded-full text-[12px] tabular-nums',
          !celda.delMes && 'text-muted-foreground/60',
          esHoy && 'bg-primary font-semibold text-primary-foreground',
        )}>
        {Number(celda.fecha.slice(8, 10))}
      </span>
      {/* ⚠ En MÓVIL solo los puntos, sin títulos. A 375 px una columna de la
          rejilla mide 47 px y los títulos quedaban en "Por…", "Tie…", "We…":
          texto recortado hasta ser inútil. Los puntos dicen que hay algo y de
          qué tipo, y al tocar el día se lee todo en el panel de detalle — que
          es como funcionan los calendarios en un móvil. */}
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

  // ─── Teclado: UNA parada de tabulador y flechas para moverse ───
  //
  // ⚠ La rejilla tiene 35 celdas y todas son botones: sin esto, cruzar el
  // calendario con el tabulador son 35 paradas que además no llevan a ningún
  // sitio. Con el tabindex rotatorio solo una entra en el orden (el día de hoy,
  // o el 1 si se está viendo otro mes) y desde ella las flechas mueven día a
  // día, con Inicio/Fin a los extremos de la semana y RePág/AvPág al mes de al
  // lado. Es el patrón de cualquier calendario, y lo que se espera al pulsar
  // una flecha estando dentro de una rejilla de fechas.
  //
  // Sin `role="grid"` a propósito: las celdas son BOTONES de verdad (abren o
  // dan de alta), y cambiarles el rol a `gridcell` les quitaría eso a cambio de
  // una semántica que aquí no aporta. Las flechas son una comodidad encima.
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

  // ⚠ El detalle a la vista al abrirlo. En MÓVIL la rejilla del mes ocupa más
  // que la pantalla, así que el panel nacía fuera —medido: y = 935 con una
  // ventana de 812— y tocar un día parecía no hacer nada. Y es justo donde el
  // panel es la ÚNICA forma de leer el día: las celdas solo llevan puntos.
  // `block: 'nearest'` no mueve nada si ya se ve, así que en escritorio no
  // pasa nada.
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
                    ? 'border-border bg-card/50 text-foreground'
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

      {/* Rejilla. Cada celda es un BOTÓN: un día vacío da de alta una tarea en
          esa fecha (lo que se espera al pulsar un día de un calendario) y uno
          con eventos abre su detalle debajo. */}
      <div ref={rejilla} onKeyDown={teclas} className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-card/50">
          {/* ⚠ El nombre largo se lee SIEMPRE, también en móvil ("Mié" se lee
              mal en voz alta), y por eso está en el DOM con `sr-only` en vez de
              en un `aria-label` del div: un `aria-label` en un div SIN ROL no
              existe —la especificación lo prohíbe y el lector se lo salta—, que
              es la trampa que ya documenta CLAUDE.md. Aquí estaba puesta: la
              cabecera parecía accesible y en móvil solo se anunciaba "MIÉ". */}
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
          <div key={i} className="grid grid-cols-7 border-b border-border/60 last:border-0">
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
        <div ref={detalle} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            {/* h2 y no h3: va bajo el h1 de la página y en esta pestaña no hay
                nada en medio — saltarse un nivel rompe el orden de encabezados
                (la regla está en CLAUDE.md, y aquí estaba incumplida). */}
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
                      className="flex w-full items-start gap-2.5 py-2 text-left transition-colors hover:bg-muted/40"
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
