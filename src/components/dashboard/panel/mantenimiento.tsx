'use client'

// Pestaña "Mantenimiento" del Panel de control: tareas recurrentes con su
// periodicidad, separadas por ÁMBITO — servidor (revisar deps, backups,
// dominio...), casa, vehículo (ITV, seguro, revisión) y los que se añadan: los
// ámbitos son una tabla editable, no una lista fija. "Hecho" encadena el
// siguiente vencimiento; el cron de la app avisa por correo de las vencidas
// (diario a las 8:00, reaviso semanal).
import { useState, useTransition } from 'react'
import {
  CalendarClock, Check, Pencil, Plus, Tag, Trash2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { DateField, Field, NumberField, SelectField, TextField, TextareaField } from '@/components/ui/fields'
import type { AmbitoRow } from '@/lib/mantenimiento'
import {
  completeMaintenance, createAmbito, createMaintenance, deleteAmbito, deleteMaintenance,
  updateAmbito, updateMaintenance,
} from '@/app/app/panel/actions'

export interface MaintenanceRow {
  uuid: string
  title: string
  scopeUuid: string | null
  /** Nombre de su ámbito (null solo si el ámbito se borró). */
  scopeName: string | null
  notes: string | null
  intervalMonths: number
  nextDue: string // 'YYYY-MM-DD'
  lastDone: string | null // 'YYYY-MM-DD'
}

const ESTADO_TAREA = {
  vencida: { className: 'bg-danger-bg text-danger', label: 'Vencida' },
  proxima: { className: 'bg-warning-bg text-warning', label: 'Esta semana' },
  aldia: { className: 'bg-success-bg text-success', label: 'Al día' },
} as const

// Mismo criterio que el cron (src/lib/mantenimiento.ts), sobre el "hoy" del servidor.
const estadoDe = (nextDue: string, hoy: string): keyof typeof ESTADO_TAREA => {
  if (nextDue <= hoy) return 'vencida'
  const dias = (new Date(`${nextDue}T00:00:00Z`).getTime() - new Date(`${hoy}T00:00:00Z`).getTime()) / 86_400_000
  return dias <= 7 ? 'proxima' : 'aldia'
}

const fmt = (iso: string) => iso.split('-').reverse().join('/')

const dias = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000)

/** Periodicidad en una palabra: "cada 1 mes" no lo dice nadie. */
export function periodicidad(meses: number): string {
  const nombres: Record<number, string> = {
    1: 'Mensual', 2: 'Bimestral', 3: 'Trimestral', 4: 'Cuatrimestral',
    6: 'Semestral', 12: 'Anual', 24: 'Cada 2 años',
  }
  if (nombres[meses]) return nombres[meses]
  return meses % 12 === 0 ? `Cada ${meses / 12} años` : `Cada ${meses} meses`
}

/** Cuándo toca, en relativo: lo que se quiere saber es cuánto falta (o cuánto
 *  se lleva de retraso), no una fecha que hay que restar de cabeza. */
export function cuando(nextDue: string, hoy: string): string {
  const d = dias(hoy, nextDue)
  if (d === 0) return 'Vence hoy'
  if (d < 0) {
    const atraso = Math.abs(d)
    if (atraso === 1) return 'Venció ayer'
    if (atraso < 30) return `Hace ${atraso} días`
    const meses = Math.round(atraso / 30)
    return meses === 1 ? 'Hace un mes' : `Hace ${meses} meses`
  }
  if (d === 1) return 'Mañana'
  if (d < 60) return `En ${d} días`
  const meses = Math.round(d / 30)
  return meses >= 12 && meses % 12 === 0
    ? `En ${meses / 12} ${meses === 12 ? 'año' : 'años'}`
    : `En ${meses} meses`
}

/** Antigüedad de la última vez que se hizo ("hace 6 días", "hace un mes"). */
export function antiguedad(lastDone: string, hoy: string): string {
  const d = dias(lastDone, hoy)
  if (d <= 0) return 'hecha hoy'
  if (d === 1) return 'hecha ayer'
  if (d < 30) return `hecha hace ${d} días`
  const meses = Math.round(d / 30)
  if (meses < 12) return meses === 1 ? 'hecha hace un mes' : `hecha hace ${meses} meses`
  const años = Math.round(meses / 12)
  return años === 1 ? 'hecha hace un año' : `hecha hace ${años} años`
}

const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
const btnOutline =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
const btnIcon =
  'rounded-md p-2 max-sm:p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40'

interface Borrador {
  title: string
  scopeUuid: string
  notes: string
  intervalMonths: number | null
  nextDue: string
}

const BORRADOR_VACIO: Borrador = {
  title: '', scopeUuid: '', notes: '', intervalMonths: 1, nextDue: '',
}


export function MantenimientoTab({
  rows, ambitos, hoy, smtpListo,
}: {
  rows: MaintenanceRow[]
  ambitos: AmbitoRow[]
  hoy: string // 'YYYY-MM-DD' en horario de Madrid (calculado en el servidor)
  smtpListo: boolean
}) {
  const [pending, startTransition] = useTransition()
  // null = cerrado · 'nueva' = alta · uuid = edición
  const [modal, setModal] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_VACIO)
  const [confirming, setConfirming] = useState<string | null>(null)
  // 'todos' o el uuid de un ámbito.
  const [filtro, setFiltro] = useState<string>('todos')
  const [gestionAmbitos, setGestionAmbitos] = useState(false)

  const opcionesAmbito = ambitos.map((a) => ({ value: a.uuid, label: a.name }))
  const nombreAmbito = (uuid: string) => ambitos.find((a) => a.uuid === uuid)?.name ?? ''

  const run = (promise: Promise<{ ok: boolean; message?: string }>, success?: string) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      if (success) toast.success(success)
      setModal(null)
    })

  const abrirNueva = () => {
    // El primer ámbito por defecto: hay que elegir uno y así no se olvida.
    setBorrador({ ...BORRADOR_VACIO, scopeUuid: ambitos[0]?.uuid ?? '', nextDue: hoy })
    setModal('nueva')
  }

  const abrirEdicion = (t: MaintenanceRow) => {
    setBorrador({
      title: t.title,
      scopeUuid: t.scopeUuid ?? ambitos[0]?.uuid ?? '',
      notes: t.notes ?? '',
      intervalMonths: t.intervalMonths,
      nextDue: t.nextDue,
    })
    setModal(t.uuid)
  }

  const guardar = () => {
    const datos = {
      title: borrador.title,
      scopeUuid: borrador.scopeUuid,
      notes: borrador.notes || null,
      intervalMonths: borrador.intervalMonths ?? 0,
      nextDue: borrador.nextDue,
    }
    if (modal === 'nueva') run(createMaintenance(datos), 'Tarea creada')
    else if (modal) run(updateMaintenance(modal, datos), 'Tarea actualizada')
  }

  const visibles = filtro === 'todos' ? rows : rows.filter((t) => t.scopeUuid === filtro)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!smtpListo && (
          <span className="rounded-md bg-warning-bg px-2.5 py-1 text-xs font-semibold text-warning">
            SMTP sin configurar: los avisos por correo están inactivos
          </span>
        )}
        {/* Filtro por ámbito: solo con más de uno en uso —con todo en el
            servidor no filtra nada y sería ruido. */}
        {new Set(rows.map((t) => t.scopeUuid)).size > 1 && (
          <div
            className="flex overflow-x-auto rounded-lg border border-border bg-card/50 p-0.5 max-sm:w-full"
            role="group"
            aria-label="Filtrar por ámbito">
            {[{ uuid: 'todos', name: 'Todos' }, ...ambitos].map((a) => (
              <button
                key={a.uuid}
                type="button"
                className={cn(
                  'whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition-colors max-sm:flex-1 max-sm:py-2',
                  filtro === a.uuid
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setFiltro(a.uuid)}>
                {a.name}
              </button>
            ))}
          </div>
        )}
        <span className="flex-1" />
        <button
          type="button"
          className={cn(btnOutline, 'max-sm:w-full')}
          onClick={() => setGestionAmbitos(true)}>
          <Tag className="size-4" /> Ámbitos
        </button>
        <button type="button" className={cn(btnPrimary, 'w-full sm:w-auto')} onClick={abrirNueva}>
          <Plus className="size-4" /> Nueva tarea
        </button>
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <CalendarClock className="mx-auto mb-2 size-6 text-muted-foreground/60" />
          {rows.length === 0
            ? 'Sin tareas todavía. Ejemplos útiles: revisar dependencias cada mes, comprobar backups cada mes, la ITV cada 12 meses o la revisión de la caldera cada año.'
            : `Ninguna tarea de ${nombreAmbito(filtro).toLowerCase()}.`}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-card">
          {visibles.map((t) => {
            const estado = ESTADO_TAREA[estadoDe(t.nextDue, hoy)]
            // El chip dice CUÁNDO (y el color, la urgencia): más útil que
            // repetir "Vencida" y dejar la fecha para calcular a mano.
            const chip = (
              <span
                className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold', estado.className)}
                title={`${estado.label} · vence el ${fmt(t.nextDue)}`}>
                {cuando(t.nextDue, hoy)}
              </span>
            )
            return (
              // Móvil: tarjeta en bloque (chip junto al título, acciones en su
              // propia fila con "Hecha" etiquetada). Desde sm, la fila de antes.
              <div key={t.uuid} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    {/* min-w-0 en el título y shrink-0 en el chip: con títulos
                        largos el chip no se aplasta, el texto se ajusta. */}
                    <p className="min-w-0 text-sm font-semibold">{t.title}</p>
                    <span className="shrink-0 sm:hidden">{chip}</span>
                  </div>
                  <p
                    className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted-foreground"
                    title={`Vence el ${fmt(t.nextDue)}`}>
                    {/* Ámbito: en la lista mezclada es lo que dice si esto es
                        del servidor, de casa o del coche. */}
                    <span className="font-semibold text-foreground/80">
                      {t.scopeName ?? 'Sin ámbito'}
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      {periodicidad(t.intervalMonths)}
                      {t.lastDone && ` · ${antiguedad(t.lastDone, hoy)}`}
                    </span>
                  </p>
                  {/* La nota ES la instrucción de la tarea: en móvil se muestra
                      entera (con 2 líneas se perdía entre un tercio y la mitad
                      del texto, sin forma de leerlo salvo editando). En
                      escritorio caben en 1-2 líneas y el clamp queda de red por
                      si alguna nota fuera larguísima. */}
                  {t.notes && (
                    <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground/70 max-sm:line-clamp-none sm:line-clamp-2">
                      {t.notes}
                    </p>
                  )}
                </div>
                <span className="hidden shrink-0 sm:block">{chip}</span>
                <span className="flex items-center justify-end gap-0.5 border-t border-border/60 pt-2 sm:border-0 sm:pt-0">
                  <button
                    type="button"
                    className={cn(
                      btnIcon,
                      'mr-auto flex items-center gap-1 text-success hover:bg-success-bg hover:text-success sm:mr-0',
                    )}
                    disabled={pending}
                    title="Marcar como hecha (encadena el siguiente vencimiento)"
                    onClick={() => run(completeMaintenance(t.uuid), 'Hecha: siguiente vencimiento programado')}>
                    <Check className="size-4" />
                    <span className="text-xs font-semibold sm:hidden">Hecha</span>
                  </button>
                  <button type="button" className={btnIcon} aria-label="Editar" disabled={pending} onClick={() => abrirEdicion(t)}>
                    <Pencil className="size-3.5" />
                  </button>
                  {confirming === t.uuid ? (
                    <>
                      <button
                        type="button"
                        className="rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white max-sm:px-3 max-sm:py-2"
                        onClick={() => {
                          setConfirming(null)
                          run(deleteMaintenance(t.uuid), 'Tarea eliminada')
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
                      disabled={pending}
                      onClick={() => setConfirming(t.uuid)}>
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Alta / edición */}
      {modal !== null && (
        <Modal
          title={modal === 'nueva' ? 'Nueva tarea de mantenimiento' : 'Editar tarea'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className={btnOutline} onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={pending || !borrador.title.trim() || !borrador.nextDue || !borrador.scopeUuid}
                onClick={guardar}>
                {modal === 'nueva' ? 'Crear' : 'Guardar'}
              </button>
            </>
          }>
            <div className="flex flex-col gap-3">
              <Field label="Tarea *">
                <TextField
                  ariaLabel="Tarea"
                  value={borrador.title}
                  autoFocus
                  onChange={(v) => setBorrador((b) => ({ ...b, title: v }))}
                />
              </Field>
              <Field label="Ámbito *">
                <SelectField
                  className="w-40"
                  ariaLabel="Ámbito de la tarea"
                  placeholder="Elige un ámbito"
                  value={borrador.scopeUuid}
                  onChange={(v) => setBorrador((b) => ({ ...b, scopeUuid: v }))}
                  options={opcionesAmbito}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cada (meses) *">
                  <NumberField
                    ariaLabel="Periodicidad en meses"
                    value={borrador.intervalMonths}
                    step={1}
                    onChange={(v) => setBorrador((b) => ({ ...b, intervalMonths: v }))}
                  />
                </Field>
                <Field label="Próximo vencimiento *">
                  <DateField
                    ariaLabel="Próximo vencimiento"
                    value={borrador.nextDue}
                    onChange={(v) => setBorrador((b) => ({ ...b, nextDue: v }))}
                  />
                </Field>
              </div>
              <Field label="Notas (salen en el correo)">
                <TextareaField
                  ariaLabel="Notas"
                  value={borrador.notes}
                  onChange={(v) => setBorrador((b) => ({ ...b, notes: v }))}
                />
              </Field>
            </div>
        </Modal>
      )}

      {gestionAmbitos && (
        <AmbitosModal ambitos={ambitos} onClose={() => setGestionAmbitos(false)} />
      )}
    </div>
  )
}

/**
 * Gestión de los ámbitos: crear, renombrar y borrar.
 *
 * En modal y no en una sección propia (como sí hicieron las categorías de
 * gastos) porque son cuatro o cinco, no diecinueve: no hacen falta buscador ni
 * filtros. Renombrar es seguro — las tareas apuntan por uuid, no por nombre.
 */
function AmbitosModal({ ambitos, onClose }: { ambitos: AmbitoRow[]; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [editando, setEditando] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [nuevo, setNuevo] = useState('')

  const run = (promise: Promise<{ ok: boolean; message?: string }>, success: string, luego?: () => void) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(success)
      luego?.()
    })

  const crear = () => {
    if (!nuevo.trim()) return
    run(createAmbito({ name: nuevo }), 'Ámbito creado', () => setNuevo(''))
  }

  return (
    <Modal
      title="Ámbitos de mantenimiento"
      description="Los grupos en los que se reparten las tareas. Renombrar uno no toca sus tareas; borrarlo solo se puede si no lo usa ninguna."
      onClose={onClose}
      footer={
        <button type="button" className={btnOutline} onClick={onClose}>
          Cerrar
        </button>
      }>
      {ambitos.length === 0 && (
        <p className="pb-1 text-[13px] text-muted-foreground">
          Ninguno todavía: crea el primero abajo (servidor, casa, vehículo...).
        </p>
      )}

      {ambitos.map((a) => (
        <div key={a.uuid} className="border-b border-border/60 py-2">
          {editando === a.uuid ? (
            <div className="flex items-center gap-2">
              <TextField
                className="min-w-0 flex-1"
                ariaLabel={`Nombre de ${a.name}`}
                value={nombre}
                autoFocus
                onChange={setNombre}
                onEnter={() =>
                  run(updateAmbito(a.uuid, { name: nombre }), 'Ámbito actualizado', () =>
                    setEditando(null),
                  )
                }
              />
              <span className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  className={btnIcon}
                  aria-label="Guardar"
                  disabled={pending || !nombre.trim()}
                  onClick={() =>
                    run(updateAmbito(a.uuid, { name: nombre }), 'Ámbito actualizado', () =>
                      setEditando(null),
                    )
                  }>
                  <Check className="size-4 text-success" />
                </button>
                <button
                  type="button"
                  className={btnIcon}
                  aria-label="Cancelar"
                  onClick={() => setEditando(null)}>
                  <X className="size-4" />
                </button>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.name}</span>
              <span className="shrink-0 text-[12px] text-muted-foreground">
                {a.tareas === 0 ? 'sin tareas' : `${a.tareas} ${a.tareas === 1 ? 'tarea' : 'tareas'}`}
              </span>
              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  className={btnIcon}
                  aria-label={`Renombrar ${a.name}`}
                  onClick={() => {
                    setNombre(a.name)
                    setEditando(a.uuid)
                  }}>
                  <Pencil className="size-3.5" />
                </button>
                {/* Un ámbito en uso no se borra: sus tareas se quedarían sin
                    clasificar en silencio. Primero se cambian de ámbito. */}
                <button
                  type="button"
                  className={cn(
                    btnIcon,
                    a.tareas > 0
                      ? 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground'
                      : 'hover:bg-danger-bg hover:text-danger',
                  )}
                  aria-label={`Eliminar ${a.name}`}
                  aria-disabled={a.tareas > 0}
                  title={
                    a.tareas > 0
                      ? `No se puede borrar: lo usa${a.tareas === 1 ? ' 1 tarea' : `n ${a.tareas} tareas`}. Cámbialas de ámbito primero.`
                      : 'Eliminar'
                  }
                  onClick={() => {
                    if (a.tareas > 0) {
                      toast.error(
                        `«${a.name}» no se puede borrar: lo usa${a.tareas === 1 ? ' 1 tarea' : `n ${a.tareas} tareas`}. Cámbialas de ámbito primero.`,
                      )
                      return
                    }
                    run(deleteAmbito(a.uuid), `Ámbito ${a.name} eliminado`)
                  }}>
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
          )}
        </div>
      ))}

      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-1.5 text-[13px] text-muted-foreground">Nuevo ámbito</p>
        <div className="flex items-center gap-2">
          <TextField
            className="min-w-0 flex-1"
            ariaLabel="Nombre del ámbito nuevo"
            placeholder="Nombre"
            value={nuevo}
            onChange={setNuevo}
            onEnter={crear}
          />
          <button
            type="button"
            className={cn(btnPrimary, 'shrink-0 px-2.5 max-sm:py-2.5')}
            aria-label="Añadir ámbito"
            disabled={pending || !nuevo.trim()}
            onClick={crear}>
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </Modal>
  )
}
