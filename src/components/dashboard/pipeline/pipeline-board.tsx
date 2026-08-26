'use client'

// Tablero del pipeline de oportunidades (solo administrador): métricas del
// embudo y, en escritorio (md+), el kanban de 5 columnas con drag&drop y
// botones ←/→. En móvil el kanban no es cómodo y NO se muestra: la vista de
// trabajo es la Tabla (listado completo, cuyas tarjetas mueven de estado con
// un selector) — el conmutador ni ofrece "Tablero" en pantallas pequeñas.
// Además, vistas Tabla (todas) e Histórico (archivadas), ambas sobre
// TablaOportunidades. El detalle/edición y el timeline viven en OportunidadModal.
import { useState, useTransition } from 'react'
import {
  Archive, CalendarClock, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { MetricasPipeline } from '@/lib/pipeline'
import { archiveOpportunity, deleteOpportunity, updateOpportunity } from '@/app/app/pipeline/actions'
import { OportunidadModal } from './oportunidad-modal'
import { TablaOportunidades } from './tabla-oportunidades'
import {
  CLASE_URGENCIA, COLUMNAS, TERMINALES, btnIcon, btnPrimary, eur, fmtFecha, urgenciaSeguimiento,
  type EstadoOportunidad, type OpportunityRow,
} from './comun'

export type { EstadoOportunidad, OpportunityRow } from './comun'

type Run = (promise: Promise<{ ok: boolean; message?: string }>, success?: string) => void

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{valor}</p>
    </div>
  )
}

// Tarjeta del tablero, compartida por el kanban de escritorio y la lista
// móvil: mismo contenido, y el control de mover estado (flechas o selector)
// lo aporta cada variante vía `moverControl`.
function Tarjeta({
  o, hoy, pending, confirming, setConfirming, run, onEditar, moverControl, dragProps, className,
}: {
  o: OpportunityRow
  hoy: string
  pending: boolean
  confirming: string | null
  setConfirming: (v: string | null) => void
  run: Run
  onEditar: () => void
  /** Control de movimiento (izquierda del pie): ←/→ en escritorio, selector en móvil. */
  moverControl: React.ReactNode
  dragProps?: React.HTMLAttributes<HTMLElement> & { draggable?: boolean }
  className?: string
}) {
  return (
    <article {...dragProps} className={cn('rounded-lg border border-border bg-card p-3', className)}>
      <p className="text-sm font-semibold leading-snug">{o.title}</p>
      {o.company && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{o.company}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {o.origin && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            {o.origin}
          </span>
        )}
        {o.amount !== null && (
          <span className="rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-semibold text-success">
            {eur(o.amount)}
          </span>
        )}
      </div>

      {/* Seguimiento: la tarjeta avisa si la próxima acción venció */}
      {o.nextActionDate && (
        <p
          className={cn(
            'mt-1.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium',
            CLASE_URGENCIA[urgenciaSeguimiento(o.nextActionDate, hoy)],
          )}>
          <CalendarClock className="size-3 shrink-0" />
          <span className="truncate">
            {fmtFecha(o.nextActionDate)}
            {o.nextAction ? ` · ${o.nextAction}` : ''}
          </span>
        </p>
      )}
      {!o.nextActionDate && o.nextAction && (
        <p className="mt-1.5 flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
          <CalendarClock className="size-3 shrink-0" />
          <span className="truncate">{o.nextAction}</span>
        </p>
      )}

      {o.notes && (
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">
          {o.notes}
        </p>
      )}
      {o.closedAt && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Terminada el {fmtFecha(o.closedAt)}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-1.5">
        {moverControl}
        <span className="flex items-center">
          {TERMINALES.includes(o.status) && (
            <button
              type="button"
              className={btnIcon}
              title="Archivar (mover al histórico)"
              aria-label="Archivar"
              disabled={pending}
              onClick={() => run(archiveOpportunity(o.uuid, true), 'Archivada en el histórico')}>
              <Archive className="size-3.5" />
            </button>
          )}
          <button type="button" className={btnIcon} aria-label="Editar" onClick={onEditar}>
            <Pencil className="size-3.5" />
          </button>
          {confirming === o.uuid ? (
            <>
              <button
                type="button"
                className="rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white"
                onClick={() => {
                  setConfirming(null)
                  run(deleteOpportunity(o.uuid), 'Oportunidad eliminada')
                }}>
                Sí
              </button>
              <button type="button" className={btnIcon} aria-label="Cancelar" onClick={() => setConfirming(null)}>
                <X className="size-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              className={cn(btnIcon, 'hover:bg-danger-bg hover:text-danger')}
              aria-label="Eliminar"
              onClick={() => setConfirming(o.uuid)}>
              <Trash2 className="size-3.5" />
            </button>
          )}
        </span>
      </div>
    </article>
  )
}

export function PipelineBoard({
  rows, archivadas, metricas, hoy,
}: {
  rows: OpportunityRow[]
  archivadas: OpportunityRow[]
  metricas: MetricasPipeline
  hoy: string // 'YYYY-MM-DD' (Madrid)
}) {
  const [pending, startTransition] = useTransition()
  const [vista, setVista] = useState<'tablero' | 'tabla' | 'historico'>('tablero')
  // null = cerrado · 'nueva' = alta · fila = edición de esa tarjeta
  const [modal, setModal] = useState<OpportunityRow | 'nueva' | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  // Drag&drop (solo escritorio): uuid arrastrado y columna bajo el puntero.
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<EstadoOportunidad | null>(null)

  const run: Run = (promise, success) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      if (success) toast.success(success)
    })

  const moverA = (o: OpportunityRow, estado: EstadoOportunidad) => {
    if (o.status === estado) return
    const destino = COLUMNAS.find((c) => c.estado === estado)!
    run(updateOpportunity(o.uuid, { status: estado }), `Movida a ${destino.label}`)
  }

  const mover = (o: OpportunityRow, direccion: -1 | 1) => {
    const destino = COLUMNAS[COLUMNAS.findIndex((c) => c.estado === o.status) + direccion]
    if (destino) moverA(o, destino.estado)
  }

  const soltar = (estado: EstadoOportunidad) => {
    const o = drag === null ? undefined : rows.find((r) => r.uuid === drag)
    setDrag(null)
    setOver(null)
    if (o) moverA(o, estado)
  }

  // Tabla = listado completo (activas y archivadas) por última actividad.
  const todas = [...rows, ...archivadas].sort((a, b) => b.updateTs.localeCompare(a.updateTs))

  return (
    <div>
      {/* Métricas del embudo (miran también el histórico archivado) */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica label="Valor abierto" valor={eur(metricas.valorAbierto)} />
        <Metrica label="Abiertas" valor={String(metricas.abiertas)} />
        <Metrica
          label="Tasa de cierre"
          valor={metricas.tasaCierre === null ? '—' : `${metricas.tasaCierre} %`}
        />
        <Metrica
          label="Cierre medio"
          valor={metricas.diasMedioCierre === null ? '—' : `${metricas.diasMedioCierre} días`}
        />
      </div>

      {/* En móvil los controles se apilan y "Tablero" no existe: la vista de
          trabajo es la Tabla (si la vista guardada es el tablero, en móvil se
          resalta y se muestra la Tabla — puro CSS, sin líos de hidratación). */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-border bg-card/50 p-0.5 sm:inline-flex">
          <button
            type="button"
            className={cn(
              'hidden flex-1 rounded-md px-3 py-1 text-sm font-semibold transition-colors md:block sm:flex-none',
              vista === 'tablero' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setVista('tablero')}>
            Tablero
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 rounded-md px-3 py-1 text-sm font-semibold transition-colors sm:flex-none',
              vista === 'tabla' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              vista === 'tablero' && 'max-md:bg-muted max-md:text-foreground',
            )}
            onClick={() => setVista('tabla')}>
            Tabla
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 rounded-md px-3 py-1 text-sm font-semibold transition-colors sm:flex-none',
              vista === 'historico' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setVista('historico')}>
            Histórico{archivadas.length ? ` (${archivadas.length})` : ''}
          </button>
        </div>
        <button type="button" className={cn(btnPrimary, 'w-full sm:w-auto')} onClick={() => setModal('nueva')}>
          <Plus className="size-4" /> Nueva oportunidad
        </button>
      </div>

      {/* Tabla: listado completo; Histórico: solo archivadas. En móvil la
          vista "tablero" también muestra la Tabla (el kanban no existe ahí). */}
      {(vista === 'tabla' || vista === 'tablero') && (
        <div className={cn(vista === 'tablero' && 'md:hidden')}>
          <TablaOportunidades rows={todas} hoy={hoy} contexto="todas" onEditar={setModal} onMover={moverA} />
        </div>
      )}
      {vista === 'historico' && (
        <TablaOportunidades rows={archivadas} hoy={hoy} contexto="historico" onEditar={setModal} />
      )}

      {/* Tablero escritorio: kanban de 5 columnas con drag&drop y ←/→
          (scroll horizontal entre md y lg, donde aún no caben las 5). */}
      {vista === 'tablero' && (
        <div className="hidden overflow-x-auto pb-2 md:block">
          <div className="grid min-w-260 grid-cols-5 gap-3">
            {COLUMNAS.map((col) => {
              const tarjetas = rows.filter((o) => o.status === col.estado)
              return (
                <div
                  key={col.estado}
                  className={cn(
                    'rounded-xl border border-border bg-card/50 p-2 transition-colors',
                    drag !== null && over === col.estado && 'border-primary/60 bg-primary/5',
                  )}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setOver(col.estado)
                  }}
                  onDragLeave={() => setOver((v) => (v === col.estado ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault()
                    soltar(col.estado)
                  }}>
                  <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
                    <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', col.accent)}>
                      {col.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{tarjetas.length}</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {tarjetas.length === 0 && (
                      <p className="px-1.5 py-3 text-center text-xs text-muted-foreground/60">Vacío</p>
                    )}
                    {tarjetas.map((o) => (
                      <Tarjeta
                        key={o.uuid}
                        o={o}
                        hoy={hoy}
                        pending={pending}
                        confirming={confirming}
                        setConfirming={setConfirming}
                        run={run}
                        onEditar={() => setModal(o)}
                        className={cn('cursor-grab active:cursor-grabbing', drag === o.uuid && 'opacity-50')}
                        dragProps={{
                          draggable: true,
                          onDragStart: (e) => {
                            e.dataTransfer.effectAllowed = 'move'
                            setDrag(o.uuid)
                          },
                          onDragEnd: () => {
                            setDrag(null)
                            setOver(null)
                          },
                        }}
                        moverControl={
                          <span className="flex">
                            <button
                              type="button"
                              className={btnIcon}
                              disabled={pending || o.status === COLUMNAS[0].estado}
                              title="Mover al estado anterior"
                              aria-label="Mover al estado anterior"
                              onClick={() => mover(o, -1)}>
                              <ChevronLeft className="size-4" />
                            </button>
                            <button
                              type="button"
                              className={btnIcon}
                              disabled={pending || o.status === COLUMNAS[COLUMNAS.length - 1].estado}
                              title="Mover al siguiente estado"
                              aria-label="Mover al siguiente estado"
                              onClick={() => mover(o, 1)}>
                              <ChevronRight className="size-4" />
                            </button>
                          </span>
                        }
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {modal !== null && (
        <OportunidadModal
          oportunidad={modal === 'nueva' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
