'use client'

// Pestaña de un año del módulo de finanzas: sistema de ahorro anual (réplica
// del Excel "Ahorro Anual"). El servidor entrega el detalle del año activo;
// aquí vive la interactividad (control mensual, extras, viajes, objetivo) y
// las mutaciones van por server actions. La gestión de años (crear/editar/
// eliminar) vive en FinanzasTabs y el resumen global en ResumenGeneral.
import { useMemo, useState, useTransition } from 'react'
import {
  Landmark, CalendarCheck, Check, Compass, Gift, Pencil, Percent, Plus,
  Save, Target, Trash2, TrendingUp, Wallet, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { NumberField, TextField } from '@/components/ui/fields'
import { useConfirmar } from '@/components/dashboard/confirmar'
import type { ConceptRow, MonthRow, YearDetail } from '@/lib/finance'
import {
  addExtra, addTravel, deleteExtra, deleteTravel,
  saveMonths, updateExtra, updateTravel,
} from '@/app/app/finance/actions'
import { AhorroPorMes } from '@/components/dashboard/savings/charts'
import { MESES } from '@/lib/fechas'
import { GraficaDonut } from '@/components/ui/charts/donut'
import { btnIcon, btnPrimary, cardClass, esperadoHoy, eur, pct, proyeccionDe } from './comun'
import { tdClass, thClass } from '@/components/ui/tabla'



// Restante de uso diario de un mes (null si el mes no tiene ingreso).
const restanteDe = (m: MonthRow) =>
  m.income === null || m.income === undefined ? null : m.income - (m.savingGeneral || 0) - (m.savingTravel || 0)

// Borrador del control mensual: siempre 12 filas (rellena los meses que faltan).
const buildDraft = (months: MonthRow[]): MonthRow[] =>
  MESES.map((_, i) => {
    const m = months.find((x) => x.month === i + 1)
    return { month: i + 1, income: m?.income ?? null, savingGeneral: m?.savingGeneral ?? null, savingTravel: m?.savingTravel ?? null }
  })

// Entrada numérica en euros (vacío = null), sobre el campo custom. Flechas y
// teclado ↑/↓ suman de 50 en 50 (importes); los campos de año pasan step={1}.
function NumInput({
  value, onChange, placeholder = '—', autoFocus, small, onEnter, step = 50,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  autoFocus?: boolean
  small?: boolean
  onEnter?: () => void
  step?: number
}) {
  return (
    <NumberField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onEnter={onEnter}
      step={step}
      compact={small}
      className={cn(small && 'max-w-32.5')}
    />
  )
}

// ─────────── conceptos (extras y gastos de viaje) ───────────

type ConceptPayload = { concept: string; amount: number }

// Formulario inline de concepto + importe.
function ConceptForm({ placeholder, onAdd }: {
  placeholder: string
  onAdd: (datos: ConceptPayload) => Promise<boolean>
}) {
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (!concept.trim() || amount === null) return
    startTransition(async () => {
      const ok = await onAdd({ concept: concept.trim(), amount })
      if (ok) { setConcept(''); setAmount(null) }
    })
  }

  return (
    // En móvil el concepto ocupa su propia fila; importe y botón forman la
    // segunda (evita que el flex-wrap deje el botón "+" huérfano).
    <div className="mt-3 flex flex-wrap gap-2">
      <TextField
        className="w-full min-w-0 sm:w-auto sm:min-w-35 sm:flex-1"
        placeholder={placeholder}
        value={concept}
        onChange={setConcept}
        onEnter={submit}
      />
      <div className="w-27.5 min-w-0 flex-1 sm:flex-none">
        <NumInput value={amount} onChange={setAmount} placeholder="Importe" onEnter={submit} />
      </div>
      <button type="button" className={btnPrimary} onClick={submit} disabled={pending || !concept.trim() || amount === null} aria-label="Añadir">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

// Lista de conceptos con importe, edición inline y borrado.
function ConceptList({ items, onDelete, onUpdate, emptyText }: {
  items: ConceptRow[]
  onDelete: (uuid: string) => void
  onUpdate: (uuid: string, datos: ConceptPayload) => Promise<boolean>
  emptyText: string
}) {
  const confirmar = useConfirmar()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ concept: string; amount: number | null }>({ concept: '', amount: null })

  if (!items.length) return <p className="py-2.5 text-[13px] text-muted-foreground">{emptyText}</p>

  const startEdit = (it: ConceptRow) => {
    setEditing(it.uuid)
    setDraft({ concept: it.concept, amount: it.amount })
  }

  const saveEdit = async () => {
    if (!draft.concept.trim() || draft.amount === null || !editing) return
    const ok = await onUpdate(editing, { concept: draft.concept.trim(), amount: draft.amount })
    if (ok) setEditing(null)
  }

  return (
    <>
      {items.map((it) => (
        <div key={it.uuid} className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5">
          {editing === it.uuid ? (
            <>
              <TextField
                className="min-w-0 flex-1 py-1"
                ariaLabel="Concepto"
                value={draft.concept}
                onChange={(v) => setDraft((d) => ({ ...d, concept: v }))}
                onEnter={saveEdit}
              />
              <div className="w-25 flex-none">
                <NumInput small value={draft.amount} onChange={(v) => setDraft((d) => ({ ...d, amount: v }))} onEnter={saveEdit} />
              </div>
              <span className="flex flex-none gap-0.5">
                <button type="button" className={btnIcon} onClick={saveEdit} aria-label="Guardar">
                  <Check className="size-4 text-success" />
                </button>
                <button type="button" className={btnIcon} onClick={() => setEditing(null)} aria-label="Cancelar">
                  <X className="size-4" />
                </button>
              </span>
            </>
          ) : (
            <>
              <span className="min-w-0 truncate text-[13.5px]">{it.concept}</span>
              <span className="flex flex-none items-center gap-0.5">
                <span className="mr-1.5 text-[13.5px] font-semibold">{eur(it.amount)}</span>
                <button type="button" className={btnIcon} onClick={() => startEdit(it)} aria-label="Editar">
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  className={cn(btnIcon, 'hover:bg-danger-bg hover:text-danger')}
                  aria-label="Eliminar"
                  onClick={async () => {
                    if (
                      await confirmar({
                        clave: 'borrar-concepto-ahorro',
                        titulo: 'Eliminar el concepto',
                        texto: `Se eliminará «${it.concept}» (${eur(it.amount)}).`,
                      })
                    ) {
                      onDelete(it.uuid)
                    }
                  }}>
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </>
          )}
        </div>
      ))}
    </>
  )
}

// ─────────── módulo principal ───────────

export function SavingsModule({
  detail, hoy,
}: {
  detail: YearDetail | null
  hoy: string // 'YYYY-MM-DD' (Madrid)
}) {
  const [saving, startSaving] = useTransition()

  // Borrador editable del control mensual, derivado del detalle del servidor:
  // se reconstruye cuando cambian los datos guardados (patrón "derived state").
  const monthsKey = JSON.stringify(detail?.months ?? [])
  const [prevKey, setPrevKey] = useState(monthsKey)
  const [monthsDraft, setMonthsDraft] = useState<MonthRow[]>(() => buildDraft(detail?.months ?? []))
  if (monthsKey !== prevKey) {
    setPrevKey(monthsKey)
    setMonthsDraft(buildDraft(detail?.months ?? []))
  }

  // ───────── derivados del año seleccionado ─────────
  const resumen = useMemo(() => {
    if (!detail) return null
    const extrasTotal = detail.extras.reduce((s, e) => s + e.amount, 0)
    const mesesGeneral = monthsDraft.reduce((s, m) => s + (m.savingGeneral || 0), 0)
    const ahorroViajes = monthsDraft.reduce((s, m) => s + (m.savingTravel || 0), 0)
    const gastadoViajes = detail.travels.reduce((s, t) => s + t.amount, 0)
    // Ahorro anual = mensual + extras + sobrante de viajes (lo no gastado se
    // suma al cierre; el año siguiente los viajes empiezan de cero).
    const ahorroAnual = mesesGeneral + extrasTotal + (ahorroViajes - gastadoViajes)
    const conAhorro = monthsDraft.filter((m) => (m.savingGeneral || 0) > 0)
    const restantes = monthsDraft.map(restanteDe).filter((r): r is number => r !== null && r >= 0)
    return {
      extrasTotal, ahorroAnual, ahorroViajes, gastadoViajes,
      quedaViajes: ahorroViajes - gastadoViajes,
      restanteAnual: monthsDraft.reduce((s, m) => s + (restanteDe(m) || 0), 0),
      totalIngresos: monthsDraft.reduce((s, m) => s + (m.income || 0), 0),
      totalGeneral: mesesGeneral,
      kpiMedioMensual: conAhorro.length ? mesesGeneral / conAhorro.length : null,
      kpiMesesAhorro: conAhorro.length / 12,
      kpiDependenciaExtras: ahorroAnual > 0 ? extrasTotal / ahorroAnual : null,
      kpiMargenMedio: restantes.length ? restantes.reduce((s, r) => s + r, 0) / restantes.length : null,
      kpiRitmoViajes: ahorroViajes > 0 ? gastadoViajes / ahorroViajes : null,
    }
  }, [detail, monthsDraft])

  const dirty = useMemo(
    () => !!detail && JSON.stringify(monthsDraft) !== JSON.stringify(buildDraft(detail.months)),
    [detail, monthsDraft],
  )

  // ───────── acciones ─────────
  const run = async (promise: Promise<{ ok: boolean; message?: string }>, success?: string) => {
    const res = await promise
    if (!res.ok) { toast.error(res.message ?? 'Error'); return false }
    if (success) toast.success(success)
    return true
  }

  const onCellChange = (month: number, field: 'income' | 'savingGeneral' | 'savingTravel', value: number | null) =>
    setMonthsDraft((prev) => prev.map((m) => (m.month === month ? { ...m, [field]: value } : m)))

  const onSaveMonths = () =>
    startSaving(async () => {
      if (!detail) return
      await run(saveMonths(detail.year.uuid, monthsDraft), 'Control mensual guardado')
    })

  const goal = detail?.year.goal ?? null
  const goalPct = goal && resumen ? Math.round((resumen.ahorroAnual / goal) * 100) : 0

  // ───────── asistente del año en curso: ritmo, proyección y desvío ─────────
  const esCorriente = detail?.year.year === Number(hoy.slice(0, 4))
  const mesActual = Number(hoy.slice(5, 7))
  // Los aportes fijos de la proyección: extras + sobrante de viajes.
  const proy = detail && esCorriente && resumen
    ? proyeccionDe(monthsDraft, resumen.extrasTotal + resumen.quedaViajes, goal, mesActual)
    : null
  // Objetivo prorrateado a hoy y desvío del ritmo (solo con objetivo).
  const esperado = detail && goal ? esperadoHoy(goal, detail.year.year, hoy) : null
  const desvio = esperado !== null && resumen ? resumen.ahorroAnual - esperado : null

  const kpis = resumen
    ? [
        {
          label: 'Tasa de ahorro',
          // Los extras son ahorro Y son ingresos: van en los dos lados de la
          // división (si no, la tasa se infla y puede pasar del 100%).
          value: pct(
            resumen.totalIngresos + resumen.extrasTotal > 0
              ? resumen.ahorroAnual / (resumen.totalIngresos + resumen.extrasTotal)
              : null,
          ),
          Icon: Percent,
        },
        { label: 'Ahorro mensual medio', value: eur(resumen.kpiMedioMensual), Icon: TrendingUp },
        { label: 'Meses con ahorro', value: pct(resumen.kpiMesesAhorro), Icon: CalendarCheck },
        { label: 'Dependencia de extras', value: pct(resumen.kpiDependenciaExtras), Icon: Gift },
        { label: 'Margen personal medio', value: eur(resumen.kpiMargenMedio), Icon: Wallet },
        { label: 'Ritmo de viajes', value: pct(resumen.kpiRitmoViajes), Icon: Compass },
      ]
    : []

  // Las clases de la tabla vienen de `ui/tabla` (esta tabla es la referencia
  // del resto: ver la cabecera de ese módulo).

  return (
    <div>
      {!detail || !resumen ? (
        <div className={cn(cardClass, 'py-16 text-center text-muted-foreground')}>
          Este año no existe. Vuelve al Resumen o crea uno en la sección Ajustes.
        </div>
      ) : (
        <>
          {/* Resumen del año: todo gira alrededor del ahorro (sin capital) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Ingresos del año', value: resumen.totalIngresos, Icon: Landmark },
              { title: 'Ahorro anual (con sobrante)', value: resumen.ahorroAnual, Icon: TrendingUp, color: 'text-success', bold: true },
              { title: 'Ahorro para viajes', value: resumen.ahorroViajes, Icon: Compass, color: 'text-viajes' },
              { title: 'Restante uso diario', value: resumen.restanteAnual, Icon: Wallet },
            ].map((s) => (
              <div key={s.title} className={cn(cardClass, 'p-5')}>
                <p className="mb-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
                  <s.Icon className={cn('size-4', s.color ?? 'text-primary')} /> {s.title}
                </p>
                <p className={cn('text-2xl font-semibold', s.bold && 'text-primary')}>{eur(s.value)}</p>
              </div>
            ))}
          </div>

          {/* Objetivo anual con barra de progreso y ritmo temporal */}
          <div className={cn(cardClass, 'mt-4 px-5 py-3.5')}>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                <Target className="size-4 text-primary" />
                Objetivo anual
                {goal !== null ? (
                  <span className="font-medium text-muted-foreground">{eur(goal)}</span>
                ) : (
                  <span className="font-medium text-muted-foreground">sin fijar</span>
                )}
                {/* Desvío frente al objetivo prorrateado a día de hoy */}
                {esCorriente && desvio !== null && (
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-semibold',
                      desvio >= 0 ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger',
                    )}
                    title={`A estas alturas del año "tocaría" llevar ${eur(esperado)}`}>
                    {desvio >= 0 ? '▲' : '▼'} {eur(Math.abs(desvio))} {desvio >= 0 ? 'por delante' : 'por detrás'}
                  </span>
                )}
              </span>
            </div>
            {goal !== null && (
              <>
                {/* La marca vertical señala dónde "tocaría" estar hoy (prorrateo por día) */}
                <div className="relative mt-2.5 h-2 rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all', goalPct >= 100 ? 'bg-success' : 'bg-primary')}
                    style={{ width: `${Math.min(100, goalPct)}%` }}
                  />
                  {esCorriente && esperado !== null && (
                    <div
                      className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground/60"
                      style={{ left: `${Math.min(100, (esperado / goal) * 100)}%` }}
                      title={`Esperado a día de hoy: ${eur(esperado)}`}
                    />
                  )}
                </div>
                <div className="mt-1.5 flex justify-between text-[12.5px] text-muted-foreground">
                  <span>{eur(resumen.ahorroAnual)} de {eur(goal)} ({goalPct}&nbsp;%)</span>
                  <span>{goalPct >= 100 ? '🎉 Objetivo cumplido' : `Faltan ${eur(goal - resumen.ahorroAnual)}`}</span>
                </div>
              </>
            )}

            {/* Asistente del año en curso: ritmo, proyección y lo necesario */}
            {esCorriente && proy && (
              <div className="mt-3 grid gap-2.5 border-t border-border/60 pt-3 sm:grid-cols-3">
                <div>
                  <p className="text-[12px] text-muted-foreground">Ritmo actual</p>
                  <p className="text-sm font-semibold">
                    {proy.mediaMensual === null ? '—' : `${eur(proy.mediaMensual)}/mes`}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-muted-foreground">Proyección a fin de año</p>
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      goal !== null && proy.proyeccion !== null && (proy.proyeccion >= goal ? 'text-success' : 'text-danger'),
                    )}>
                    {proy.proyeccion === null ? '—' : eur(proy.proyeccion)}
                    {goal !== null && proy.proyeccion !== null && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        {proy.proyeccion >= goal ? 'da para el objetivo' : 'se queda corta'}
                      </span>
                    )}
                  </p>
                </div>
                {goal !== null && (
                  <div>
                    <p className="text-[12px] text-muted-foreground">
                      Para cumplirlo ({proy.mesesFuturos} {proy.mesesFuturos === 1 ? 'mes' : 'meses'} por delante)
                    </p>
                    <p className="text-sm font-semibold">
                      {proy.necesarioMensual === null
                        ? '—'
                        : proy.necesarioMensual === 0
                          ? '🎉 Ya está cumplido'
                          : `${eur(proy.necesarioMensual)}/mes`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* min-w-0 en las columnas: sin él, el ancho mínimo de la tabla
              mensual (560px) se propaga al grid y desborda la página en móvil
              en vez de quedarse en su scroller. */}
          {/* Aquí la pareja sí espera a xl: la columna de 15fr solo da 600px
              en lg y la gráfica mensual (lienzo de 760) se encogería a 0,79 —
              apilada a todo lo ancho se ve mejor que emparejada y pequeña. */}
          {/* La pareja se forma desde lg: la gráfica mensual ya se ajusta al
              hueco, así que emparejar no la encoge — y apilada, la tabla de
              12×4 se estiraba a 1085px con las cifras desparramadas. */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[15fr_9fr]">
            {/* Control mensual + evolución */}
            <div className="min-w-0">
              <div className={cardClass}>
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h3 className="font-semibold">Control mensual</h3>
                  <button type="button" className={btnPrimary} disabled={!dirty || saving} onClick={onSaveMonths}>
                    <Save className="size-4" />
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
                {/* Escritorio: tabla (12 filas × 4 columnas) */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-140 text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {/* Columna fija: al scrollear en móvil siempre se ve qué mes editas */}
                        <th className={cn(thClass, 'sticky left-0 z-10 border-r border-border/60 bg-card')}>Mes</th>
                        <th className={thClass}>Ingreso</th>
                        <th className={thClass}>Ahorro general</th>
                        <th className={thClass}>Ahorro viajes</th>
                        <th className={cn(thClass, 'text-right')}>Restante uso diario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthsDraft.map((m) => {
                        const rest = restanteDe(m)
                        // Solo en el año en curso: se resalta el mes actual y
                        // se marca con un punto los pasados sin rellenar.
                        const esMesActual = esCorriente && m.month === mesActual
                        const sinRellenar =
                          esCorriente && m.month < mesActual &&
                          m.income === null && m.savingGeneral === null && m.savingTravel === null
                        return (
                          <tr key={m.month} className={cn('border-b border-border/50', esMesActual && 'bg-primary/5')}>
                            <td
                              className={cn(
                                tdClass,
                                'sticky left-0 z-10 border-r border-border/60 bg-card font-semibold',
                                esMesActual && 'text-primary',
                              )}>
                              {MESES[m.month - 1]}
                              {sinRellenar && (
                                <span
                                  className="ml-1.5 inline-block size-1.5 rounded-full bg-warning align-middle"
                                  title="Mes sin rellenar"
                                />
                              )}
                            </td>
                            <td className={tdClass}>
                              <NumInput small value={m.income} onChange={(v) => onCellChange(m.month, 'income', v)} />
                            </td>
                            <td className={tdClass}>
                              <NumInput small value={m.savingGeneral} onChange={(v) => onCellChange(m.month, 'savingGeneral', v)} />
                            </td>
                            <td className={tdClass}>
                              <NumInput small value={m.savingTravel} onChange={(v) => onCellChange(m.month, 'savingTravel', v)} />
                            </td>
                            <td className={cn(tdClass, 'text-right font-semibold')}>
                              {rest === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span className={rest < 0 ? 'text-danger' : ''}>{eur(rest)}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="bg-muted/50 font-semibold">
                        <td className={cn(tdClass, 'sticky left-0 z-10 border-r border-border/60 bg-card')}>Totales</td>
                        <td className={tdClass}>{eur(resumen.totalIngresos)}</td>
                        <td className={tdClass}>{eur(resumen.totalGeneral)}</td>
                        <td className={tdClass}>{eur(resumen.ahorroViajes)}</td>
                        <td className={cn(tdClass, 'text-right')}>{eur(resumen.restanteAnual)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Móvil: una tarjeta por mes (la tabla obligaba a scrollear a ciegas) */}
                <div className="flex flex-col gap-2 p-3 md:hidden">
                  {monthsDraft.map((m) => {
                    const rest = restanteDe(m)
                    const esMesActual = esCorriente && m.month === mesActual
                    const sinRellenar =
                      esCorriente && m.month < mesActual &&
                      m.income === null && m.savingGeneral === null && m.savingTravel === null
                    return (
                      <div
                        key={m.month}
                        className={cn('rounded-lg border border-border bg-card p-3', esMesActual && 'border-primary/50')}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className={cn('text-sm font-semibold', esMesActual && 'text-primary')}>
                            {MESES[m.month - 1]}
                            {sinRellenar && (
                              <span
                                className="ml-1.5 inline-block size-1.5 rounded-full bg-warning align-middle"
                                title="Mes sin rellenar"
                              />
                            )}
                          </span>
                          <span className="text-[12.5px] text-muted-foreground">
                            Restante{' '}
                            <span className={cn('font-semibold', rest !== null && rest < 0 ? 'text-danger' : 'text-foreground')}>
                              {rest === null ? '—' : eur(rest)}
                            </span>
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              { label: 'Ingreso', campo: 'income', valor: m.income },
                              { label: 'General', campo: 'savingGeneral', valor: m.savingGeneral },
                              { label: 'Viajes', campo: 'savingTravel', valor: m.savingTravel },
                            ] as const
                          ).map((c) => (
                            <div key={c.campo}>
                              <p className="mb-1 text-[11px] text-muted-foreground">{c.label}</p>
                              <NumInput small value={c.valor} onChange={(v) => onCellChange(m.month, c.campo, v)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  <div className="rounded-lg bg-muted/50 p-3 text-[13px]">
                    <p className="mb-1.5 font-semibold">Totales</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                      <span>Ingresos <span className="font-semibold text-foreground">{eur(resumen.totalIngresos)}</span></span>
                      <span>General <span className="font-semibold text-foreground">{eur(resumen.totalGeneral)}</span></span>
                      <span>Viajes <span className="font-semibold text-foreground">{eur(resumen.ahorroViajes)}</span></span>
                      <span>Restante <span className="font-semibold text-foreground">{eur(resumen.restanteAnual)}</span></span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={cn(cardClass, 'mt-4')}>
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h3 className="font-semibold">Evolución mensual</h3>
                  <span className="text-[12.5px] text-muted-foreground">
                    <span className="mr-1.5 inline-block size-2.5 rounded-xs bg-primary" />General
                    <span className="ml-3.5 mr-1.5 inline-block size-2.5 rounded-xs bg-viajes" />Viajes
                  </span>
                </div>
                {/* Una sola gráfica: mide su hueco y se pinta a escala 1:1
                    (apretándose sola en móvil), así que sobran las variantes. */}
                <div className="px-4 py-3">
                  <AhorroPorMes months={monthsDraft} />
                </div>
              </div>

              {/* Composición del ahorro anual: pesos de cada fuente */}
              <div className={cn(cardClass, 'mt-4')}>
                <h3 className="border-b border-border px-5 py-3 font-semibold">Composición del ahorro</h3>
                <div className="px-5 py-4">
                  <GraficaDonut
                    titulo="Composición del ahorro anual"
                    centro="ahorro anual"
                    vacio="Sin datos de ahorro todavía."
                    partes={[
                      { label: 'Ahorro mensual', valor: resumen.totalGeneral, color: 'var(--primary)' },
                      { label: 'Ingresos extraordinarios', valor: resumen.extrasTotal, color: 'var(--success)' },
                      { label: 'Sobrante de viajes', valor: resumen.quedaViajes, color: 'var(--viajes)' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Columna derecha: extras, viajes y KPIs */}
            <div className="min-w-0">
              <div className={cn(cardClass, 'px-5 pb-4 pt-3')}>
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <h3 className="font-semibold">Ingresos extraordinarios</h3>
                  <span className="rounded-md bg-success-bg px-2 py-0.5 text-xs font-semibold text-success">
                    {eur(resumen.extrasTotal)}
                  </span>
                </div>
                <ConceptList
                  items={detail.extras}
                  emptyText="Sin ingresos extra este año."
                  onDelete={(uuid) => run(deleteExtra(uuid))}
                  onUpdate={(uuid, datos) => run(updateExtra(uuid, datos))}
                />
                <ConceptForm placeholder="Concepto" onAdd={(datos) => run(addExtra(detail.year.uuid, datos))} />
              </div>

              <div className={cn(cardClass, 'mt-4 px-5 pb-4 pt-3')}>
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <h3 className="font-semibold">Viajes</h3>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-semibold',
                      resumen.quedaViajes < 0 ? 'bg-danger-bg text-danger' : 'bg-viajes-bg text-viajes',
                    )}>
                    Quedan {eur(resumen.quedaViajes)}
                  </span>
                </div>
                <div className="flex justify-between py-2 text-[13px] text-muted-foreground">
                  <span>Ahorrado {eur(resumen.ahorroViajes)}</span>
                  <span>Gastado {eur(resumen.gastadoViajes)}</span>
                </div>
                <ConceptList
                  items={detail.travels}
                  emptyText="Sin gastos de viajes todavía."
                  onDelete={(uuid) => run(deleteTravel(uuid))}
                  onUpdate={(uuid, datos) => run(updateTravel(uuid, datos))}
                />
                <ConceptForm placeholder="Concepto" onAdd={(datos) => run(addTravel(detail.year.uuid, datos))} />
              </div>

              <div className={cn(cardClass, 'mt-4 px-5 py-2')}>
                <h3 className="border-b border-border py-2.5 font-semibold">KPIs del año</h3>
                {kpis.map((k, i) => (
                  <div key={k.label} className={cn('flex items-center justify-between py-2.5', i < kpis.length - 1 && 'border-b border-border/60')}>
                    <span className="flex items-center gap-2 text-[13.5px] text-muted-foreground">
                      <k.Icon className="size-4 text-primary" />
                      {k.label}
                    </span>
                    <span className="text-sm font-semibold">{k.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  )
}
