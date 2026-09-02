'use client'

// Pestaña "Mantenimiento" del Panel de control: tareas recurrentes con su
// periodicidad, separadas por ÁMBITO — servidor (revisar deps, backups,
// dominio...), casa, vehículo (ITV, seguro, revisión) y los que se añadan: los
// ámbitos son una tabla editable, no una lista fija. "Hecho" encadena el
// siguiente vencimiento; el cron de la app avisa por correo de las vencidas
// (diario a las 8:00, reaviso semanal).
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarClock, CalendarDays, Check, List, Pencil, Plus, Tag, Trash2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { useConfirmar } from '@/components/dashboard/confirmar'
import { useCarga } from '@/components/dashboard/barra-carga'
import { DateField, Field, NumberField, SelectField, TextField, TextareaField } from '@/components/ui/fields'
import { MESES, sumarMeses } from '@/lib/fechas'
import type { AmbitoRow } from '@/lib/mantenimiento'
import {
  completeMaintenance, createAmbito, createMaintenance, deleteAmbito, deleteMaintenance,
  updateAmbito, updateMaintenance,
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

/**
 * Periodicidad en una palabra: "cada 1 mes" no lo dice nadie.
 *
 * `null` es un **recordatorio puntual**: no se repite. Se nombra "Una vez"
 * y no "Sin periodicidad" porque lo que hay que entender de un vistazo en la
 * lista es que esa fila pasará una sola vez.
 */
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


/** Una tarea cayendo en un mes concreto de la proyección. */
export interface Ocurrencia {
  uuid: string
  title: string
  scopeName: string | null
  /** Fecha del vencimiento, 'YYYY-MM-DD'. */
  fecha: string
  /** Venció antes del mes en curso (arrastra retraso). */
  atrasada: boolean
}

/** Un mes de la proyección con lo que vence en él. */
export interface MesProyectado {
  /** 'YYYY-MM' */
  mes: string
  tareas: Ocurrencia[]
}

// Tope de saltos al proyectar UNA tarea: con periodicidad mensual, 12 meses son
// 12 saltos; el tope solo existe para que una fecha absurda (o un intervalo
// corrupto) no cuelgue el bucle.
const MAX_SALTOS = 600

/**
 * Proyecta los vencimientos de los próximos `meses` meses (el actual incluido).
 *
 * Encadena cada tarea desde su próximo vencimiento sumando su periodicidad, así
 * que una tarea mensual sale doce veces y la ITV una. Lo que ya venció antes de
 * este mes se muestra en el mes en curso marcado como atrasado —es lo que hay
 * que hacer ya— y a partir de ahí sigue su serie normal.
 *
 * Es una función pura para poder probarla: la aritmética de meses cortos y el
 * cruce de año son justo donde esto se rompe.
 */
export function proximosMeses(
  rows: MaintenanceRow[],
  hoy: string,
  meses = 12,
): MesProyectado[] {
  const inicio = `${hoy.slice(0, 7)}-01`
  const fin = sumarMeses(inicio, meses) // primer día del mes siguiente a la ventana
  const cubos = new Map<string, Ocurrencia[]>()
  const orden: string[] = []
  for (let i = 0; i < meses; i++) {
    const m = sumarMeses(inicio, i).slice(0, 7)
    orden.push(m)
    cubos.set(m, [])
  }

  for (const t of rows) {
    // Un recordatorio puntual sale UNA vez, en su mes (o en el actual si ya
    // se pasó): no hay serie que encadenar.
    if (t.intervalMonths === null) {
      const atrasada = t.nextDue < inicio
      const cubo = atrasada ? orden[0] : t.nextDue.slice(0, 7)
      if (atrasada || t.nextDue < fin) {
        cubos.get(cubo)?.push({
          uuid: t.uuid,
          title: t.title,
          scopeName: t.scopeName,
          fecha: t.nextDue,
          atrasada,
        })
      }
      continue
    }
    const paso = Math.max(1, t.intervalMonths)
    let f = t.nextDue
    if (f < inicio) {
      // Atrasada: se enseña en el mes en curso con su fecha real, y luego se
      // adelanta su serie hasta entrar en la ventana.
      cubos.get(orden[0])?.push({
        uuid: t.uuid, title: t.title, scopeName: t.scopeName, fecha: f, atrasada: true,
      })
      let saltos = 0
      while (f < inicio && saltos++ < MAX_SALTOS) f = sumarMeses(f, paso)
    }
    let saltos = 0
    while (f < fin && saltos++ < MAX_SALTOS) {
      cubos.get(f.slice(0, 7))?.push({
        uuid: t.uuid, title: t.title, scopeName: t.scopeName, fecha: f, atrasada: false,
      })
      f = sumarMeses(f, paso)
    }
  }

  return orden.map((mes) => ({
    mes,
    tareas: (cubos.get(mes) ?? []).sort((a, b) => a.fecha.localeCompare(b.fecha)),
  }))
}

/**
 * Calendario de los próximos 12 meses: qué vence y cuándo.
 *
 * La lista contesta "qué tengo pendiente"; esto contesta "qué se me viene
 * encima" — con la ITV, el seguro y la caldera repartidos, el mes cargado se ve
 * de un vistazo. Los meses sin nada también salen (en gris): un hueco es
 * información, y saltárselos descolocaría la rejilla.
 */
function Calendario({ meses, hoy }: { meses: MesProyectado[]; hoy: string }) {
  const mesActual = hoy.slice(0, 7)
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {meses.map((m) => {
        const [y, mm] = m.mes.split('-').map(Number)
        const esActual = m.mes === mesActual
        return (
          <div
            key={m.mes}
            className={cn(
              'rounded-xl border bg-card p-3.5',
              esActual ? 'border-primary/40' : 'border-border',
              m.tareas.length === 0 && 'opacity-60',
            )}>
            <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-border/60 pb-2">
              <p className="text-sm font-semibold">
                {MESES[mm - 1]}
                {/* El año, solo cuando cambia: en una ventana de 12 meses la
                    mitad son del año que viene. */}
                {y !== Number(mesActual.slice(0, 4)) && (
                  <span className="ml-1 font-normal text-muted-foreground">{y}</span>
                )}
              </p>
              {esActual ? (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                  Este mes
                </span>
              ) : (
                m.tareas.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">{m.tareas.length}</span>
                )
              )}
            </div>
            {m.tareas.length === 0 ? (
              <p className="py-1 text-[12.5px] text-muted-foreground">Nada previsto</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {m.tareas.map((t) => (
                  // La clave lleva la fecha: una tarea mensual sale una vez por
                  // mes, y en el mes en curso puede salir además su atraso.
                  <li key={`${t.uuid}-${t.fecha}`} className="flex items-baseline gap-2 text-[12.5px]">
                    <span
                      className={cn(
                        'w-11 shrink-0 tabular-nums',
                        t.atrasada ? 'font-semibold text-danger' : 'text-muted-foreground',
                      )}
                      title={t.atrasada ? `Vencía el ${fmt(t.fecha)}` : `Vence el ${fmt(t.fecha)}`}>
                      {t.atrasada ? 'Vencida' : fmt(t.fecha).slice(0, 5)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{t.title}</span>
                      {t.scopeName && (
                        <span className="text-muted-foreground"> · {t.scopeName}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

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
  rows, ambitos, hoy, smtpListo, vista,
}: {
  rows: MaintenanceRow[]
  ambitos: AmbitoRow[]
  hoy: string // 'YYYY-MM-DD' en horario de Madrid (calculado en el servidor)
  smtpListo: boolean
  /** Vista activa, que vive en la URL (`?vista=`). */
  vista: 'lista' | 'calendario'
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
  const setVista = (v: 'lista' | 'calendario') => {
    if (v === vista) return
    iniciar()
    router.push(v === 'calendario' ? '/app/panel?tab=mantenimiento&vista=calendario' : '/app/panel?tab=mantenimiento')
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
      // null llega tal cual: es "no se repite", no un cero.
      intervalMonths: borrador.intervalMonths,
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
                  chipFiltro,
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
        {/* Lista / Calendario: la lista gestiona, el calendario planifica */}
        <div
          className="flex rounded-lg border border-border bg-card/50 p-0.5 max-sm:w-full"
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
                vista === v.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
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
        <button type="button" className={cn(btnPrimary, 'w-full sm:w-auto')} onClick={abrirNueva}>
          <Plus className="size-4" /> Nueva tarea
        </button>
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <CalendarClock className="mx-auto mb-2 size-6 text-muted-foreground" />
          {rows.length === 0
            ? 'Sin tareas todavía. Ejemplos útiles: revisar dependencias cada mes, comprobar backups cada mes, la ITV cada 12 meses o la revisión de la caldera cada año.'
            : `Ninguna tarea de ${nombreAmbito(filtro).toLowerCase()}.`}
        </div>
      ) : vista === 'calendario' ? (
        <Calendario meses={proximosMeses(visibles, hoy)} hoy={hoy} />
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
                    <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground max-sm:line-clamp-none sm:line-clamp-2">
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
                  {/* "Hecha" se queda fuera: es LA acción de la tarjeta, y en
                      móvil lleva su etiqueta. Lo secundario (editar, borrar)
                      se recoge en el menú para que no compita con ella. */}
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
              {/* Repetición: "Una vez" es lo que convierte esta pantalla en un
                  recordatorio suelto ("renovar el dominio") en vez de solo una
                  tarea que caduca cada N meses. Con "Una vez" el campo de los
                  meses desaparece: no hay periodicidad que pedir. */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Repetición *">
                  <SelectField
                    ariaLabel="Repetición de la tarea"
                    value={borrador.intervalMonths === null ? 'una' : 'repite'}
                    onChange={(v) =>
                      setBorrador((b) => ({
                        ...b,
                        // Al volver a "Se repite" se ofrece el mensual, que es
                        // el caso más común y deja el campo ya usable.
                        intervalMonths: v === 'una' ? null : (b.intervalMonths ?? 1),
                      }))
                    }
                    options={[
                      { value: 'repite', label: 'Se repite' },
                      { value: 'una', label: 'Una vez' },
                    ]}
                  />
                </Field>
                <Field label={borrador.intervalMonths === null ? 'Fecha *' : 'Próximo vencimiento *'}>
                  <DateField
                    ariaLabel="Fecha de vencimiento"
                    value={borrador.nextDue}
                    onChange={(v) => setBorrador((b) => ({ ...b, nextDue: v }))}
                  />
                </Field>
              </div>
              {borrador.intervalMonths !== null && (
                <Field label="Cada (meses) *">
                  <NumberField
                    ariaLabel="Periodicidad en meses"
                    value={borrador.intervalMonths}
                    step={1}
                    onChange={(v) => setBorrador((b) => ({ ...b, intervalMonths: v }))}
                  />
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
