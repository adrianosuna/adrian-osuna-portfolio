'use client'

// Vista de tabla del pipeline, con dos contextos: 'todas' (todas las
// oportunidades, activas y archivadas, con su seguimiento) e 'historico'
// (solo archivadas). Buscador, tarjetas en móvil y acciones por fila según
// su estado: editar siempre, archivar/restaurar en terminales, eliminar.
// En móvil esta ES la vista de trabajo del pipeline (el kanban no existe
// ahí): con `onMover`, las tarjetas cambian de estado con un selector.
import { useState, useTransition } from 'react'
import { Archive, ArchiveRestore, CalendarClock, Pencil, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SelectField, TextField } from '@/components/ui/fields'
import {
  archiveOpportunity, deleteOpportunity, restaurarOportunidad,
} from '@/app/app/pipeline/actions'
import { borrarConDeshacer } from '@/components/dashboard/deshacer'
import { MenuAcciones, type AccionFila } from '@/components/dashboard/menu-acciones'
import {
  CLASE_URGENCIA, cuandoSeguimiento, COLUMNAS, TERMINALES, btnOutline, eur, fmtFecha,
  urgenciaSeguimiento,
  type EstadoOportunidad, type OpportunityRow,
} from './comun'
import { tdClass, thClass } from '@/components/ui/tabla'

const chipEstado = (estado: OpportunityRow['status']) =>
  COLUMNAS.find((c) => c.estado === estado)

/** Filas por tanda. 50 caben de sobra en una pantalla larga sin pesar. */
const POR_TANDA = 50

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
  const [tanda, setTanda] = useState(POR_TANDA)
  const [qPrevio, setQPrevio] = useState('')
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

  // Se pinta de a tandas. El filtro es de CLIENTE (busca en seis campos, notas
  // incluidas), así que paginar en el servidor rompería la búsqueda: lo que se
  // recorta es lo que se PINTA, no lo que se consulta. Con el histórico de unos
  // años son cientos de filas —y cada una con su selector de estado en móvil—,
  // y ese DOM se nota al escribir en el buscador.
  const visibles = filtradas.slice(0, tanda)
  const quedan = filtradas.length - visibles.length

  // Al cambiar la búsqueda se vuelve a la primera tanda. Ajuste EN RENDER (no
  // en un efecto): así no hay un pintado intermedio con la tanda anterior, y
  // `react-hooks/set-state-in-effect` no lo permitiría de otro modo.
  if (qPrevio !== q) {
    setQPrevio(q)
    setTanda(POR_TANDA)
  }

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
      // Igual que la tarjeta del tablero: la urgencia primero y la acción
      // debajo. Con la fecha delante, en 245px de columna la acción se cortaba.
      return (
        <span
          className={cn(
            'inline-flex max-w-full items-start gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium',
            CLASE_URGENCIA[urgenciaSeguimiento(o.nextActionDate, hoy)],
          )}
          title={`${fmtFecha(o.nextActionDate)}${o.nextAction ? ` · ${o.nextAction}` : ''}`}>
          <CalendarClock className="mt-px size-3 shrink-0" />
          <span className="min-w-0">
            <span className="block">{cuandoSeguimiento(o.nextActionDate, hoy)}</span>
            {o.nextAction && (
              <span className="mt-0.5 block line-clamp-2 font-normal opacity-90">{o.nextAction}</span>
            )}
          </span>
        </span>
      )
    }
    if (o.nextAction) return <span className="text-xs text-muted-foreground">{o.nextAction}</span>
    return <span className="text-muted-foreground">—</span>
  }

  // Las acciones se DECLARAN y `MenuAcciones` decide cómo pintarlas: iconos en
  // escritorio, menú de tres puntos en móvil (aquí siempre son tres).
  const acciones = (o: OpportunityRow) => {
    const lista: AccionFila[] = [
      {
        id: 'editar',
        label: 'Editar',
        icon: <Pencil className="size-3.5" />,
        onClick: () => onEditar(o),
      },
    ]
    if (TERMINALES.includes(o.status) && !o.archived) {
      lista.push({
        id: 'archivar',
        label: 'Archivar en el histórico',
        icon: <Archive className="size-3.5" />,
        disabled: pending,
        onClick: () => run(archiveOpportunity(o.uuid, true), 'Archivada en el histórico'),
      })
    }
    if (o.archived) {
      lista.push({
        id: 'restaurar',
        label: 'Restaurar al tablero',
        icon: <ArchiveRestore className="size-3.5" />,
        disabled: pending,
        onClick: () => run(archiveOpportunity(o.uuid, false), 'Devuelta al tablero'),
      })
    }
    // Sin "¿seguro?": borra y el aviso ofrece deshacer (con su historial).
    lista.push({
      id: 'eliminar',
      label: 'Eliminar',
      icon: <Trash2 className="size-3.5" />,
      destructiva: true,
      disabled: pending,
      onClick: () =>
        startTransition(async () => {
          await borrarConDeshacer({
            borrar: () => deleteOpportunity(o.uuid),
            restaurar: restaurarOportunidad,
            mensaje: 'Oportunidad eliminada',
          })
        }),
    })
    // `desde: 2` porque la fila del histórico tiene dos y en 360 px de ancho
    // ya compiten con el título de la oportunidad.
    return <MenuAcciones acciones={lista} etiqueta={o.title} desde={2} />
  }

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
              <tr className="border-b border-border">
                <th className={thClass}>Oportunidad</th>
                <th className={thClass}>Origen</th>
                <th className={cn(thClass, 'text-right')}>Importe</th>
                <th className={thClass}>Estado</th>
                {conSeguimiento && <th className={thClass}>Seguimiento</th>}
                <th className={thClass}>Cierre</th>
                {/* La columna de acciones se NOMBRA para el lector de pantalla:
                    un `<th>` vacío deja una columna sin nombre. */}
                <th className={thClass} scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((o) => (
                <tr key={o.uuid} className="border-b border-border/50">
                  <td className={tdClass}>
                    <p className="font-semibold leading-snug">{o.title}</p>
                    {o.company && <p className="text-xs text-muted-foreground">{o.company}</p>}
                  </td>
                  <td className={cn(tdClass, 'text-muted-foreground')}>{o.origin ?? '—'}</td>
                  <td className={cn(tdClass, 'text-right tabular-nums')}>
                    {o.amount === null ? '—' : eur(o.amount)}
                  </td>
                  <td className={tdClass}>{estado(o)}</td>
                  {conSeguimiento && <td className={cn(tdClass, 'max-w-56')}>{seguimiento(o)}</td>}
                  <td className={cn(tdClass, 'text-muted-foreground')}>
                    {o.closedAt ? fmtFecha(o.closedAt) : '—'}
                  </td>
                  <td className={tdClass}>{acciones(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Móvil: tarjetas */}
      {filtradas.length > 0 && (
        <div className="flex flex-col gap-2 md:hidden">
          {visibles.map((o) => (
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

      {/* Ver más: fuera de las dos listas, para que valga igual en escritorio
          y en móvil. Solo aparece si queda algo por pintar. */}
      {quedan > 0 && (
        <div className="flex flex-col items-center gap-1 py-3">
          <button
            type="button"
            className={btnOutline}
            onClick={() => setTanda((n) => n + POR_TANDA)}>
            Ver más
          </button>
          <span className="text-xs text-muted-foreground">
            {visibles.length} de {filtradas.length}
          </span>
        </div>
      )}
    </div>
  )
}
