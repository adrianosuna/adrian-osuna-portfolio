'use client'

// Pestaña "Mantenimiento": tareas con vencimiento separadas por ámbito (tabla
// editable). "Hecha" encadena el siguiente; el cron avisa por correo de las vencidas.
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarClock, CalendarDays, Check, List, Pencil, Plus, RotateCcw, Tag, Trash2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { Modal } from '@/components/ui/modal'
import { useConfirmar } from '@/components/dashboard/confirmar'
import { useCarga } from '@/components/dashboard/barra-carga'
import { DateField, Field, NumberField, SelectField, TextField, TextareaField } from '@/components/ui/fields'
import type { AmbitoRow } from '@/lib/mantenimiento'
import type { RecurrenteCal, SeguimientoCal } from '@/lib/calendario'
import { cumplida, estadoDe } from '@/lib/tareas'
import { Calendario } from './calendario'
import {
  completeMaintenance, createAmbito, createMaintenance, deleteAmbito, deleteMaintenance,
  reopenMaintenance, updateAmbito, updateMaintenance,
} from '@/app/app/panel/actions'
import { btnIcon, btnOutline, btnPrimary, chipFiltro } from '@/components/ui/botones'
import { MenuAcciones } from '@/components/dashboard/menu-acciones'

export interface MaintenanceRow {
  uuid: string
  title: string
  scopeUuid: string | null
  /** Nombre de su ámbito (null solo si el ámbito se borró). */
  scopeName: string | null
  notes: string | null
  /** null = no se repite (recordatorio puntual). */
  intervalMonths: number | null
  nextDue: string // 'YYYY-MM-DD'
  lastDone: string | null // 'YYYY-MM-DD'
}

const ESTADO_TAREA = {
  vencida: { className: 'bg-danger-bg text-danger', label: 'Vencida' },
  proxima: { className: 'bg-warning-bg text-warning', label: 'Esta semana' },
  aldia: { className: 'bg-success-bg text-success', label: 'Al día' },
  // Una puntual ya hecha no vuelve: ni vence ni está "al día", está cumplida.
  hecha: { className: 'bg-muted text-muted-foreground', label: 'Hecha' },
} as const

/** El estado que se pinta: `estadoDe` sobre el "hoy" del servidor, con las
 *  puntuales cumplidas aparte (antes salían «Vencida» para siempre). */
const chipDe = (t: MaintenanceRow, hoy: string): keyof typeof ESTADO_TAREA =>
  cumplida(t) ? 'hecha' : estadoDe(t.nextDue, hoy)

const fmt = (iso: string) => iso.split('-').reverse().join('/')

const dias = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000)

/** Periodicidad en una palabra. `null` es un recordatorio puntual y se nombra
 *  "Una vez": lo que hay que entender de un vistazo es que pasa una sola vez. */
export function periodicidad(meses: number | null): string {
  if (meses === null) return 'Una vez'
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

/** Vistas de la pestaña: la lista y el calendario de días. */
export type Vista = 'lista' | 'calendario'

interface Borrador {
  title: string
  scopeUuid: string
  notes: string
  /** `repite` va aparte de `intervalMonths`: en la BD null es "no se repite" pero en
   *  el campo también es "vacío mientras escribo". El valor se compone al guardar. */
  repite: boolean
  intervalMonths: number | null
  nextDue: string
}

const BORRADOR_VACIO: Borrador = {
  title: '', scopeUuid: '', notes: '', repite: true, intervalMonths: 1, nextDue: '',
}

/** Los meses válidos son 1-120 (lo mismo que valida `periodicidadMeses`). */
const MESES_MIN = 1
const MESES_MAX = 120

/** Si el borrador se puede guardar. Lo comparten el botón y el Enter, para que
 *  no haya dos criterios — y para no mandar al servidor lo que ya sabemos mal. */
const borradorValido = (b: Borrador) =>
  Boolean(b.title.trim()) &&
  Boolean(b.nextDue) &&
  Boolean(b.scopeUuid) &&
  (!b.repite || (b.intervalMonths !== null && b.intervalMonths >= MESES_MIN && b.intervalMonths <= MESES_MAX))


export function MantenimientoTab({
  rows, ambitos, hoy, smtpListo, vista, recurrentes = [], seguimientos = [],
}: {
  rows: MaintenanceRow[]
  ambitos: AmbitoRow[]
  hoy: string // 'YYYY-MM-DD' en horario de Madrid (calculado en el servidor)
  smtpListo: boolean
  /** Vista activa, que vive en la URL (`?vista=`). */
  vista: Vista
  /** Las otras dos fuentes con fecha, solo para el calendario. */
  recurrentes?: RecurrenteCal[]
  seguimientos?: SeguimientoCal[]
}) {
  const router = useRouter()
  const iniciar = useCarga()
  const [pending, startTransition] = useTransition()
  // null = cerrado · 'nueva' = alta · uuid = edición
  const [modal, setModal] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_VACIO)
  const confirmar = useConfirmar()
  // 'todos' o el uuid de un ámbito.
  const [filtro, setFiltro] = useState<string>('todos')
  const [gestionAmbitos, setGestionAmbitos] = useState(false)
  // La vista NAVEGA (vive en la URL): el enlace al calendario es compartible y
  // el botón "atrás" devuelve a la lista.
  const setVista = (v: Vista) => {
    if (v === vista) return
    iniciar()
    router.push(
      v === 'lista' ? '/app/panel?tab=mantenimiento' : `/app/panel?tab=mantenimiento&vista=${v}`,
    )
  }

  const opcionesAmbito = ambitos.map((a) => ({ value: a.uuid, label: a.name }))
  const nombreAmbito = (uuid: string) => ambitos.find((a) => a.uuid === uuid)?.name ?? ''

  const run = (promise: Promise<{ ok: boolean; message?: string }>, success?: string) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      if (success) toast.success(success)
      setModal(null)
    })

  const abrirNueva = (fecha = hoy) => {
    // El primer ámbito por defecto: hay que elegir uno y así no se olvida.
    // La fecha llega del calendario cuando se pulsa un día; si no, hoy.
    setBorrador({ ...BORRADOR_VACIO, scopeUuid: ambitos[0]?.uuid ?? '', nextDue: fecha })
    setModal('nueva')
  }

  const abrirEdicion = (t: MaintenanceRow) => {
    setBorrador({
      title: t.title,
      scopeUuid: t.scopeUuid ?? ambitos[0]?.uuid ?? '',
      notes: t.notes ?? '',
      repite: t.intervalMonths !== null,
      // Si es puntual se guarda el mensual de reserva: al cambiar a «Se
      // repite» el campo sale ya usable en vez de vacío.
      intervalMonths: t.intervalMonths ?? 1,
      nextDue: t.nextDue,
    })
    setModal(t.uuid)
  }

  const guardar = () => {
    const datos = {
      title: borrador.title,
      scopeUuid: borrador.scopeUuid,
      notes: borrador.notes || null,
      // Aquí se compone lo que espera la BD: `null` es "no se repite", y solo
      // sale de `repite`, nunca de que el campo esté vacío.
      intervalMonths: borrador.repite ? borrador.intervalMonths : null,
      nextDue: borrador.nextDue,
    }
    // `pending` también: esto lo llama el Enter y la tecla no se apaga mientras se
    // guarda; dos Enter seguidos crearían la tarea dos veces.
    if (pending || !borradorValido(borrador)) return
    if (modal === 'nueva') run(createMaintenance(datos), 'Tarea creada')
    else if (modal) run(updateMaintenance(modal, datos), 'Tarea actualizada')
  }

  /** Tareas filtradas por ámbito, con las cumplidas al final: la consulta ordena por
   *  `nextDue` y una puntual cumplida salía la primera con su chip apagado. */
  const visibles = useMemo(() => {
    const base = filtro === 'todos' ? rows : rows.filter((t) => t.scopeUuid === (filtro === 'sin' ? null : filtro))
    return [...base].sort(
      (a, b) => Number(cumplida(a)) - Number(cumplida(b)) || a.nextDue.localeCompare(b.nextDue),
    )
  }, [rows, filtro])

  // Solo los ámbitos en uso llevan chip (uno vacío daba un filtro sin resultados), y
  // una tarea sin ámbito (FK SetNull) recibe el suyo para poder llegar a ella.
  const enUso = new Set(rows.map((t) => t.scopeUuid))
  const chipsAmbito = [
    { uuid: 'todos', name: 'Todos' },
    ...ambitos.filter((a) => enUso.has(a.uuid)),
    ...(enUso.has(null) ? [{ uuid: 'sin', name: 'Sin ámbito' }] : []),
  ]

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
        {enUso.size > 1 && (
          <div
            className="flex overflow-x-auto superficie-baja rounded-xl p-0.5 max-sm:w-full"
            role="group"
            aria-label="Filtrar por ámbito">
            {chipsAmbito.map((a) => (
              <button
                key={a.uuid}
                type="button"
                className={cn(
                  chipFiltro,
                  filtro === a.uuid
                    ? 'bg-white/8 text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setFiltro(a.uuid)}>
                {a.name}
              </button>
            ))}
          </div>
        )}
        <span className="flex-1" />
        {/* Lista / Calendario: la lista gestiona, el calendario planifica */}
        <div
          className="flex superficie-baja rounded-xl p-0.5 max-sm:w-full"
          role="group"
          aria-label="Vista">
          {([
            { id: 'lista', label: 'Lista', icon: List },
            { id: 'calendario', label: 'Calendario', icon: CalendarDays },
          ] as const).map((v) => (
            <button
              key={v.id}
              type="button"
              className={cn(
                chipFiltro,
                'inline-flex items-center justify-center gap-1.5',
                vista === v.id ? 'bg-white/8 text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={vista === v.id}
              onClick={() => setVista(v.id)}>
              <v.icon className="size-3.5" />
              {v.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={cn(btnOutline, 'max-sm:w-full')}
          onClick={() => setGestionAmbitos(true)}>
          <Tag className="size-4" /> Ámbitos
        </button>
        <button type="button" className={cn(btnPrimary, 'w-full sm:w-auto')} onClick={() => abrirNueva()}>
          <Plus className="size-4" /> Nueva tarea
        </button>
      </div>

      {/* El "no hay nada" es de la lista, no de la pestaña: delante del calendario lo
          tapaba entero, con sus recurrentes y seguimientos. */}
      {vista === 'calendario' ? (
        // Calendario de días con las tres fuentes. Solo las tareas se crean y editan aquí;
        // recurrentes y seguimientos llevan a su módulo (ver `panel/calendario.tsx`).
        <Calendario
          hoy={hoy}
          tareas={visibles}
          recurrentes={recurrentes}
          seguimientos={seguimientos}
          onNuevaTarea={abrirNueva}
          onAbrirTarea={(uuid) => {
            const t = rows.find((r) => r.uuid === uuid)
            if (t) abrirEdicion(t)
          }}
          onAbrirEvento={(e) => {
            iniciar()
            router.push(
              e.tipo === 'recurrente'
                ? '/app/finance?s=ajustes'
                : `/app/pipeline?abrir=${e.refUuid}`,
            )
          }}
        />
      ) : visibles.length === 0 ? (
        <div className="superficie rounded-2xl p-6 text-center text-sm text-muted-foreground">
          <CalendarClock className="mx-auto mb-2 size-6 text-muted-foreground" />
          {rows.length === 0 ? (
            'Sin tareas todavía. Ejemplos útiles: revisar dependencias cada mes, comprobar backups cada mes, la ITV cada 12 meses o la revisión de la caldera cada año.'
          ) : (
            <>
              Ninguna tarea{' '}
              {filtro === 'sin' ? 'sin ámbito' : `de ${nombreAmbito(filtro).toLowerCase()}`}.{' '}
              {/* La salida a mano: si no, el único camino es acordarse de que
                  hay un filtro puesto arriba. */}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => setFiltro('todos')}>
                Ver todas
              </button>
            </>
          )}
        </div>
      ) : (
        // `ul`/`li` para que un lector anuncie cuántas tareas hay. Lista de tarjetas y no
        // tabla: la nota es texto de varias líneas.
        <ul className="flex flex-col divide-y divide-border/60 superficie rounded-2xl">
          {visibles.map((t) => {
            const cumpl = cumplida(t)
            const estado = ESTADO_TAREA[chipDe(t, hoy)]
            // El chip dice cuándo (y el color, la urgencia). En una puntual cumplida el
            // vencimiento ya no significa nada: lo que importa es que está hecha.
            const chip = (
              <Tooltip
                texto={
                  cumpl
                    ? `Hecha el ${fmt(t.lastDone!)} · era para el ${fmt(t.nextDue)}`
                    : `${estado.label} · vence el ${fmt(t.nextDue)}`
                }>
                <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold', estado.className)}>
                  {cumpl ? 'Hecha' : cuando(t.nextDue, hoy)}
                </span>
              </Tooltip>
            )
            return (
              // Móvil: tarjeta en bloque (chip junto al título, acciones en su
              // propia fila con "Hecha" etiquetada). Desde sm, la fila de antes.
              <li key={t.uuid} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    {/* min-w-0 en el título y shrink-0 en el chip: con títulos
                        largos el chip no se aplasta, el texto se ajusta. */}
                    <p className="min-w-0 text-sm font-semibold">{t.title}</p>
                    <span className="shrink-0 sm:hidden">{chip}</span>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted-foreground">
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
                  {/* La nota es la instrucción de la tarea: en móvil se muestra entera; en
                      escritorio cabe en 1-2 líneas y el clamp queda de red. */}
                  {t.notes && (
                    <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground max-sm:line-clamp-none sm:line-clamp-2">
                      {t.notes}
                    </p>
                  )}
                </div>
                <span className="hidden shrink-0 sm:block">{chip}</span>
                <span className="flex items-center justify-end gap-0.5 border-t border-white/8 pt-2 sm:border-0 sm:pt-0">
                  {/* Una puntual ya cumplida no se vuelve a marcar: en su sitio va "Reabrir". En
                      las que se repiten, marcar otra vez encadena el siguiente vencimiento. */}
                  {cumpl ? (
                    <Tooltip
                      texto={`Hecha el ${fmt(t.lastDone!)}. Reabrir la deja pendiente otra vez para el ${fmt(t.nextDue)}`}
                      envuelto={pending}
                      className="mr-auto sm:mr-0">
                      <button
                        type="button"
                        // `aria-label` obligatorio: el `<span>` es `sm:hidden` y en escritorio el botón
                        // quedaba sin nombre accesible (el tooltip describe, no nombra).
                        aria-label={`Reabrir ${t.title}`}
                        className={cn(btnIcon, 'mr-auto flex items-center gap-1 sm:mr-0')}
                        disabled={pending}
                        onClick={() => run(reopenMaintenance(t.uuid), 'Reabierta: vuelve a estar pendiente')}>
                        <RotateCcw className="size-4" />
                        <span className="text-xs font-semibold sm:hidden">Reabrir</span>
                      </button>
                    </Tooltip>
                  ) : (
                    <Tooltip
                      texto={
                        t.intervalMonths === null
                          ? 'Marcar como hecha (es puntual: no vuelve)'
                          : 'Marcar como hecha (encadena el siguiente vencimiento)'
                      }
                      envuelto={pending}
                      className="mr-auto sm:mr-0">
                      <button
                        type="button"
                        // Ver el `aria-label` de "Reabrir": sin él, en
                        // escritorio este botón no tenía nombre ninguno.
                        aria-label={`Marcar ${t.title} como hecha`}
                        className={cn(
                          btnIcon,
                          'mr-auto flex items-center gap-1 text-success hover:bg-success-bg hover:text-success sm:mr-0',
                        )}
                        disabled={pending}
                        onClick={() =>
                          run(
                            completeMaintenance(t.uuid),
                            // ⚠ No prometer un vencimiento que no va a haber:
                            // en una puntual no se programa nada.
                            t.intervalMonths === null
                              ? 'Hecha'
                              : 'Hecha: siguiente vencimiento programado',
                          )
                        }>
                        <Check className="size-4" />
                        <span className="text-xs font-semibold sm:hidden">Hecha</span>
                      </button>
                    </Tooltip>
                  )}
                  {/* "Hecha" se queda fuera del menú: es la acción de la tarjeta y en móvil lleva
                      etiqueta. Lo secundario va al menú para no competir con ella. */}
                  <MenuAcciones
                    etiqueta={t.title}
                    desde={2}
                    acciones={[
                      {
                        id: 'editar',
                        label: 'Editar',
                        icon: <Pencil className="size-3.5" />,
                        disabled: pending,
                        onClick: () => abrirEdicion(t),
                      },
                      {
                        id: 'eliminar',
                        label: 'Eliminar',
                        icon: <Trash2 className="size-3.5" />,
                        destructiva: true,
                        disabled: pending,
                        onClick: async () => {
                          if (
                            await confirmar({
                              clave: 'borrar-mantenimiento',
                              titulo: 'Eliminar la tarea',
                              texto: `Se eliminará «${t.title}» y su historial de fechas.`,
                            })
                          ) {
                            run(deleteMaintenance(t.uuid), 'Tarea eliminada')
                          }
                        },
                      },
                    ]}
                  />
                </span>
              </li>
            )
          })}
        </ul>
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
                disabled={pending || !borradorValido(borrador)}
                onClick={guardar}>
                {modal === 'nueva' ? 'Crear' : 'Guardar'}
              </button>
            </>
          }>
            {/* Enter guarda solo desde los campos de una línea (título y meses): en Notas es
                salto de línea y en selects y fecha abre su popover. `guardar` valida por sí mismo. */}
            <div className="flex flex-col gap-3">
              <Field label="Tarea *">
                <TextField
                  ariaLabel="Tarea"
                  value={borrador.title}
                  autoFocus
                  onChange={(v) => setBorrador((b) => ({ ...b, title: v }))}
                  onEnter={guardar}
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
              {/* "Una vez" convierte la tarea en un recordatorio suelto; con ella el campo de
                  meses desaparece. */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Repetición *">
                  <SelectField
                    ariaLabel="Repetición de la tarea"
                    value={borrador.repite ? 'repite' : 'una'}
                    onChange={(v) =>
                      setBorrador((b) => ({
                        ...b,
                        repite: v === 'repite',
                        // Al volver a "Se repite" se ofrece el mensual, que es
                        // el caso más común y deja el campo ya usable.
                        intervalMonths: v === 'repite' ? (b.intervalMonths ?? 1) : b.intervalMonths,
                      }))
                    }
                    options={[
                      { value: 'repite', label: 'Se repite' },
                      { value: 'una', label: 'Una vez' },
                    ]}
                  />
                </Field>
                <Field label={borrador.repite ? 'Próximo vencimiento *' : 'Fecha *'}>
                  <DateField
                    ariaLabel="Fecha de vencimiento"
                    value={borrador.nextDue}
                    onChange={(v) => setBorrador((b) => ({ ...b, nextDue: v }))}
                  />
                </Field>
              </div>
              {borrador.repite && (
                // `w-28`: es una cifra de hasta tres dígitos. Los límites (1-120) son los del
                // servidor y el aviso sale aquí en vez de esperar al error de guardado.
                <Field label="Cada (meses) *">
                  <NumberField
                    className="w-28"
                    ariaLabel="Periodicidad en meses"
                    value={borrador.intervalMonths}
                    step={1}
                    onChange={(v) => setBorrador((b) => ({ ...b, intervalMonths: v }))}
                    onEnter={guardar}
                  />
                  {/* `span` y no `p`: esto va DENTRO del `<label>` de `Field`,
                      que solo admite contenido de frase. */}
                  {borrador.intervalMonths !== null &&
                    (borrador.intervalMonths < MESES_MIN || borrador.intervalMonths > MESES_MAX) && (
                      <span className="block text-[12px] text-danger">
                        Entre {MESES_MIN} y {MESES_MAX} meses.
                      </span>
                    )}
                </Field>
              )}
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

/** Gestión de ámbitos: crear, renombrar y borrar. En modal y no en sección: son
 *  cuatro o cinco. Renombrar es seguro, las tareas apuntan por uuid. */
function AmbitosModal({ ambitos, onClose }: { ambitos: AmbitoRow[]; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const [editando, setEditando] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [nuevo, setNuevo] = useState('')
  const confirmar = useConfirmar()

  const run = (promise: Promise<{ ok: boolean; message?: string }>, success: string, luego?: () => void) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(success)
      luego?.()
    })

  // Las dos con la MISMA guarda que sus botones (`pending` incluido): las
  // llama el Enter, que no se apaga mientras se guarda.
  const crear = () => {
    if (pending || !nuevo.trim()) return
    run(createAmbito({ name: nuevo }), 'Ámbito creado', () => setNuevo(''))
  }

  /** Guardar el renombrado. El Enter se saltaba la guarda y mandaba un nombre
   *  vacío a que lo rechazara el servidor. */
  const renombrar = (uuid: string) => {
    if (pending || !nombre.trim()) return
    run(updateAmbito(uuid, { name: nombre }), 'Ámbito actualizado', () => setEditando(null))
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

      {/* `ul`/`li`, como la lista de tareas: así se anuncia cuántos ámbitos hay
          en vez de leerse como un montón de texto suelto. */}
      <ul>
      {ambitos.map((a) => (
        <li key={a.uuid} className="border-b border-white/8 py-2">
          {editando === a.uuid ? (
            <div className="flex items-center gap-2">
              <TextField
                className="min-w-0 flex-1"
                ariaLabel={`Nombre de ${a.name}`}
                value={nombre}
                autoFocus
                onChange={setNombre}
                onEnter={() => renombrar(a.uuid)}
              />
              <span className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  className={btnIcon}
                  aria-label="Guardar"
                  disabled={pending || !nombre.trim()}
                  onClick={() => renombrar(a.uuid)}>
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
                <Tooltip
                  texto={
                    a.tareas > 0
                      ? `No se puede borrar: lo usa${a.tareas === 1 ? ' 1 tarea' : `n ${a.tareas} tareas`}. Cámbialas de ámbito primero.`
                      : 'Eliminar'
                  }>
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
                    onClick={async () => {
                      if (a.tareas > 0) {
                        toast.error(
                          `«${a.name}» no se puede borrar: lo usa${a.tareas === 1 ? ' 1 tarea' : `n ${a.tareas} tareas`}. Cámbialas de ámbito primero.`,
                        )
                        return
                      }
                      // Con confirmación, como el grupo de categorías vacío: no se pierde ninguna
                      // tarea, pero sí un nombre que hay que volver a escribir.
                      if (
                        await confirmar({
                          clave: 'borrar-ambito',
                          titulo: 'Eliminar el ámbito',
                          texto: `Se eliminará «${a.name}». No lo usa ninguna tarea.`,
                        })
                      ) {
                        run(deleteAmbito(a.uuid), `Ámbito ${a.name} eliminado`)
                      }
                    }}>
                    <Trash2 className="size-3.5" />
                  </button>
                </Tooltip>
              </span>
            </div>
          )}
        </li>
      ))}
      </ul>

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
