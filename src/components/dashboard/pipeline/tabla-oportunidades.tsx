'use client'

// Vista de tabla del pipeline, con dos contextos: 'todas' (todas las
// oportunidades, activas y archivadas, con su seguimiento) e 'historico'
// (solo archivadas). Buscador, tarjetas en móvil y acciones por fila según
// su estado: editar siempre, archivar/restaurar en terminales, eliminar.
// En móvil esta ES la vista de trabajo del pipeline (el kanban no existe
// ahí): con `onMover`, las tarjetas cambian de estado con un selector.
import { useState, useTransition } from 'react'
import { Archive, ArchiveRestore, CalendarClock, Pencil, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SelectField, TextField } from '@/components/ui/fields'
import { archiveOpportunity, deleteOpportunity } from '@/app/app/pipeline/actions'
import {
  CLASE_URGENCIA, COLUMNAS, TERMINALES, btnIcon, eur, fmtFecha, urgenciaSeguimiento,
  type EstadoOportunidad, type OpportunityRow,
} from './comun'

const chipEstado = (estado: OpportunityRow['status']) =>
  COLUMNAS.find((c) => c.estado === estado)

export function TablaOportunidades({
  rows, hoy, contexto, onEditar, onMover,
}: {
  rows: OpportunityRow[]
  hoy: string // 'YYYY-MM-DD' (Madrid)
  contexto: 'todas' | 'historico'
  onEditar: (o: OpportunityRow) => void
  /** Mover de estado desde la tarjeta móvil (solo contexto 'todas'). */
  onMover?: (o: OpportunityRow, estado: EstadoOportunidad) => void
}) {
  const [pending, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const conSeguimiento = contexto === 'todas'

  const run = (promise: Promise<{ ok: boolean; message?: string }>, success: string) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(success)
    })

  const q = busqueda.trim().toLowerCase()
  const filtradas = q
    ? rows.filter((o) =>
        [o.title, o.company, o.contact, o.origin, o.notes, o.nextAction]
          .some((campo) => campo?.toLowerCase().includes(q)),
      )
    : rows

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
        {contexto === 'historico'
          ? 'Nada archivado todavía. Al cerrar o descartar una oportunidad podrás archivarla desde su tarjeta y quedará guardada aquí.'
          : 'No hay oportunidades todavía. Crea la primera con «Nueva oportunidad».'}
      </p>
    )
  }

  const seguimiento = (o: OpportunityRow) => {
    if (o.nextActionDate) {
      return (
        <span
          className={cn(
            'inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium',
            CLASE_URGENCIA[urgenciaSeguimiento(o.nextActionDate, hoy)],
          )}
          title={o.nextAction ?? undefined}>
          <CalendarClock className="size-3 shrink-0" />
          <span className="truncate">
            {fmtFecha(o.nextActionDate)}
            {o.nextAction ? ` · ${o.nextAction}` : ''}
          </span>
        </span>
      )
    }
    if (o.nextAction) return <span className="text-xs text-muted-foreground">{o.nextAction}</span>
    return <span className="text-muted-foreground">—</span>
  }

  const acciones = (o: OpportunityRow) => (
    <span className="flex items-center justify-end">
      <button type="button" className={btnIcon} aria-label="Editar" title="Editar" onClick={() => onEditar(o)}>
        <Pencil className="size-3.5" />
      </button>
      {TERMINALES.includes(o.status) && !o.archived && (
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
      {o.archived && (
        <button
          type="button"
          className={btnIcon}
          title="Restaurar al tablero"
          aria-label="Restaurar al tablero"
          disabled={pending}
          onClick={() => run(archiveOpportunity(o.uuid, false), 'Devuelta al tablero')}>
          <ArchiveRestore className="size-3.5" />
        </button>
      )}
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
          aria-label="Eliminar definitivamente"
          title="Eliminar definitivamente"
          disabled={pending}
          onClick={() => setConfirming(o.uuid)}>
          <Trash2 className="size-3.5" />
        </button>
      )}
    </span>
  )

  const estado = (o: OpportunityRow) => {
    const chip = chipEstado(o.status)
    return (
      <span className="inline-flex items-center gap-1.5">
        {chip && (
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', chip.accent)}>
            {chip.label}
          </span>
        )}
        {conSeguimiento && o.archived && (
          <span className="text-[11px] text-muted-foreground">archivada</span>
        )}
      </span>
    )
  }

  return (
    <div>
      <div className="relative mb-3 max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <TextField
          ariaLabel="Buscar oportunidades"
          placeholder="Buscar..."
          className="pl-8"
          value={busqueda}
          onChange={setBusqueda}
        />
      </div>

      {filtradas.length === 0 && (
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">Sin resultados para «{busqueda}».</p>
      )}

      {/* Escritorio: tabla */}
      {filtradas.length > 0 && (
        <div className="hidden overflow-hidden rounded-xl border border-border md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/60 text-left text-xs text-muted-foreground">
                <th className="px-3.5 py-2.5 font-semibold">Oportunidad</th>
                <th className="px-3.5 py-2.5 font-semibold">Origen</th>
                <th className="px-3.5 py-2.5 text-right font-semibold">Importe</th>
                <th className="px-3.5 py-2.5 font-semibold">Estado</th>
                {conSeguimiento && <th className="px-3.5 py-2.5 font-semibold">Seguimiento</th>}
                <th className="px-3.5 py-2.5 font-semibold">Cierre</th>
                <th className="px-3.5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((o) => (
                <tr key={o.uuid} className="border-b border-border/60 last:border-0">
                  <td className="px-3.5 py-2.5">
                    <p className="font-semibold leading-snug">{o.title}</p>
                    {o.company && <p className="text-xs text-muted-foreground">{o.company}</p>}
                  </td>
                  <td className="px-3.5 py-2.5 text-muted-foreground">{o.origin ?? '—'}</td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums">
                    {o.amount === null ? '—' : eur(o.amount)}
                  </td>
                  <td className="px-3.5 py-2.5">{estado(o)}</td>
                  {conSeguimiento && <td className="max-w-56 px-3.5 py-2.5">{seguimiento(o)}</td>}
                  <td className="px-3.5 py-2.5 text-muted-foreground">
                    {o.closedAt ? fmtFecha(o.closedAt) : '—'}
                  </td>
                  <td className="px-2 py-2.5">{acciones(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Móvil: tarjetas */}
      {filtradas.length > 0 && (
        <div className="flex flex-col gap-2 md:hidden">
          {filtradas.map((o) => (
            <article key={o.uuid} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">{o.title}</p>
                  {o.company && <p className="text-xs text-muted-foreground">{o.company}</p>}
                </div>
                {/* Con onMover, el estado es un selector (mover con un toque);
                    las archivadas mantienen el chip: restaurar primero. */}
                {onMover && !o.archived ? (
                  <SelectField
                    ariaLabel="Mover a estado"
                    className="w-36 shrink-0"
                    value={o.status}
                    onChange={(v) => onMover(o, v as EstadoOportunidad)}
                    options={COLUMNAS.map((c) => ({ value: c.estado, label: c.label }))}
                  />
                ) : (
                  estado(o)
                )}
              </div>
              {conSeguimiento && (o.nextActionDate || o.nextAction) && (
                <div className="mt-1.5">{seguimiento(o)}</div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-1.5 text-xs text-muted-foreground">
                <span>
                  {o.closedAt ? `Cierre: ${fmtFecha(o.closedAt)}` : ''}
                  {o.closedAt && o.amount !== null && ' · '}
                  {o.amount !== null && eur(o.amount)}
                </span>
                {acciones(o)}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
