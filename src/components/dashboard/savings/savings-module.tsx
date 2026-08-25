'use client'

// Módulo "Ahorro" del dashboard: sistema de ahorro anual (réplica del Excel
// "Ahorro Anual" y del SavingsTab original). El servidor entrega el resumen de
// años y el detalle del seleccionado; aquí vive toda la interactividad y las
// mutaciones van por server actions (que revalidan y refrescan los props).
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Landmark, CalendarCheck, Check, Compass, Gift, LineChart, Pencil, Plus,
  Save, Target, Trash2, TrendingUp, Wallet, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ConceptRow, MonthRow, YearDetail, YearSummary } from '@/lib/finance'
import {
  addExtra, addTravel, createYear, deleteExtra, deleteTravel, deleteYear,
  saveMonths, updateExtra, updateTravel, updateYear,
} from '@/app/app/finance/actions'
import { CapitalChart, MonthlyChart } from '@/components/dashboard/savings/charts'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Formato de importes: euros sin decimales (mismo criterio que el Excel).
const eur = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v)
    ? '—'
    : v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

// Restante de uso diario de un mes (null si el mes no tiene ingreso).
const restanteDe = (m: MonthRow) =>
  m.income === null || m.income === undefined ? null : m.income - (m.savingGeneral || 0) - (m.savingTravel || 0)

const ahorroAnualDe = (y: YearSummary) => y.monthsGeneral + y.extrasTotal
const capitalFinalDe = (y: YearSummary) => y.initialCapital + ahorroAnualDe(y)

// Borrador del control mensual: siempre 12 filas (rellena los meses que faltan).
const buildDraft = (months: MonthRow[]): MonthRow[] =>
  MESES.map((_, i) => {
    const m = months.find((x) => x.month === i + 1)
    return { month: i + 1, income: m?.income ?? null, savingGeneral: m?.savingGeneral ?? null, savingTravel: m?.savingTravel ?? null }
  })

// ─────────── primitivas de UI ───────────

const cardClass = 'rounded-xl border border-border bg-card'
// text-base en móvil: con menos de 16px, iOS Safari hace zoom al enfocar un input.
const inputClass =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-base outline-none transition-colors focus:border-primary sm:text-sm'
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
const btnOutline =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary'
const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-danger/40 px-3.5 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-bg'
// p-2 (36px con icono): target táctil suficiente en móvil.
const btnIcon = 'rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

// Entrada numérica en euros (vacío = null).
function NumInput({
  value, onChange, placeholder = '—', autoFocus, small, onEnter,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  autoFocus?: boolean
  small?: boolean
  onEnter?: () => void
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step={50}
      className={cn(inputClass, small && 'max-w-32.5 py-1')}
      value={value ?? ''}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
    />
  )
}

// Modal ligero (overlay + panel), suficiente para los formularios del módulo.
function Modal({
  title, open, onClose, onOk, okText = 'Guardar', okDanger, children,
}: {
  title: string
  open: boolean
  onClose: () => void
  onOk: () => void
  okText?: string
  okDanger?: boolean
  children?: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-popover p-5 shadow-xl">
        <h3 className="mb-4 text-base font-bold">{title}</h3>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={btnOutline} onClick={onClose}>Cancelar</button>
          <button type="button" className={okDanger ? cn(btnDanger, 'border-danger bg-danger text-white hover:bg-danger hover:text-white') : btnPrimary} onClick={onOk}>
            {okText}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[13px] text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

// ─────────── conceptos (extras y gastos de viaje) ───────────

type ConceptPayload = { concept: string; amount: number; expenseDate?: string | null }

// Formulario inline de concepto + importe (+ fecha opcional en viajes).
function ConceptForm({ placeholder, onAdd, withDate }: {
  placeholder: string
  onAdd: (datos: ConceptPayload) => Promise<boolean>
  withDate?: boolean
}) {
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (!concept.trim() || amount === null) return
    startTransition(async () => {
      const ok = await onAdd({ concept: concept.trim(), amount, ...(withDate ? { expenseDate: date || null } : {}) })
      if (ok) { setConcept(''); setAmount(null); setDate('') }
    })
  }

  return (
    // En móvil el concepto ocupa su propia fila; fecha, importe y botón forman
    // la segunda (evita que el flex-wrap deje el botón "+" huérfano).
    <div className="mt-3 flex flex-wrap gap-2">
      <input
        className={cn(inputClass, 'w-full min-w-0 sm:w-auto sm:min-w-35 sm:flex-1')}
        placeholder={placeholder}
        value={concept}
        onChange={(e) => setConcept(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {withDate && (
        <input type="date" className={cn(inputClass, 'min-w-0 flex-1 sm:w-35 sm:flex-none')} value={date} onChange={(e) => setDate(e.target.value)} />
      )}
      <div className="w-27.5 flex-none">
        <NumInput value={amount} onChange={setAmount} placeholder="Importe" onEnter={submit} />
      </div>
      <button type="button" className={btnPrimary} onClick={submit} disabled={pending || !concept.trim() || amount === null} aria-label="Añadir">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

// Lista de conceptos con importe, fecha opcional, edición inline y borrado.
function ConceptList({ items, onDelete, onUpdate, emptyText, withDate }: {
  items: ConceptRow[]
  onDelete: (uuid: string) => void
  onUpdate: (uuid: string, datos: ConceptPayload) => Promise<boolean>
  emptyText: string
  withDate?: boolean
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ concept: string; amount: number | null; date: string }>({ concept: '', amount: null, date: '' })
  const [confirming, setConfirming] = useState<string | null>(null)

  if (!items.length) return <p className="py-2.5 text-[13px] text-muted-foreground/70">{emptyText}</p>

  const startEdit = (it: ConceptRow) => {
    setEditing(it.uuid)
    setDraft({ concept: it.concept, amount: it.amount, date: it.expenseDate ?? '' })
  }

  const saveEdit = async () => {
    if (!draft.concept.trim() || draft.amount === null || !editing) return
    const ok = await onUpdate(editing, {
      concept: draft.concept.trim(),
      amount: draft.amount,
      ...(withDate ? { expenseDate: draft.date || null } : {}),
    })
    if (ok) setEditing(null)
  }

  const fmtFecha = (d: string) => d.split('-').reverse().join('/')

  return (
    <>
      {items.map((it) => (
        <div key={it.uuid} className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5">
          {editing === it.uuid ? (
            <>
              <input
                className={cn(inputClass, 'min-w-0 flex-1 py-1')}
                value={draft.concept}
                onChange={(e) => setDraft((d) => ({ ...d, concept: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
              />
              {withDate && (
                <input type="date" className={cn(inputClass, 'w-32.5 flex-none py-1')} value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
              )}
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
              <span className="min-w-0 truncate text-[13.5px]">
                {it.concept}
                {withDate && it.expenseDate && (
                  <span className="ml-2 text-xs text-muted-foreground/70">{fmtFecha(it.expenseDate)}</span>
                )}
              </span>
              <span className="flex flex-none items-center gap-0.5">
                <span className="mr-1.5 text-[13.5px] font-semibold">{eur(it.amount)}</span>
                <button type="button" className={btnIcon} onClick={() => startEdit(it)} aria-label="Editar">
                  <Pencil className="size-3.5" />
                </button>
                {confirming === it.uuid ? (
                  <>
                    <button
                      type="button"
                      className="rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white"
                      onClick={() => { setConfirming(null); onDelete(it.uuid) }}>
                      Sí
                    </button>
                    <button type="button" className={btnIcon} onClick={() => setConfirming(null)}>
                      <X className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <button type="button" className={cn(btnIcon, 'hover:bg-danger-bg hover:text-danger')} onClick={() => setConfirming(it.uuid)} aria-label="Eliminar">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </span>
            </>
          )}
        </div>
      ))}
    </>
  )
}

// ─────────── módulo principal ───────────

interface SavingsModuleProps {
  years: YearSummary[]
  detail: YearDetail | null
}

export function SavingsModule({ years, detail }: SavingsModuleProps) {
  const router = useRouter()
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

  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState<number | null>(null)
  const [capitalDraft, setCapitalDraft] = useState<number | null>(detail?.year.initialCapital ?? null)
  const [prevCapital, setPrevCapital] = useState(detail?.year.initialCapital ?? null)
  if ((detail?.year.initialCapital ?? null) !== prevCapital) {
    setPrevCapital(detail?.year.initialCapital ?? null)
    setCapitalDraft(detail?.year.initialCapital ?? null)
  }

  const [modalNuevo, setModalNuevo] = useState(false)
  const [nuevo, setNuevo] = useState<{ year: number; capital: number | null; goal: number | null }>({
    year: new Date().getFullYear(), capital: null, goal: null,
  })
  const [modalEditar, setModalEditar] = useState(false)
  const [editar, setEditar] = useState<{ year: number; capital: number | null; goal: number | null }>({
    year: 0, capital: null, goal: null,
  })
  const [modalEliminar, setModalEliminar] = useState(false)

  // ───────── derivados del año seleccionado ─────────
  const resumen = useMemo(() => {
    if (!detail) return null
    const extrasTotal = detail.extras.reduce((s, e) => s + e.amount, 0)
    const mesesGeneral = monthsDraft.reduce((s, m) => s + (m.savingGeneral || 0), 0)
    const ahorroViajes = monthsDraft.reduce((s, m) => s + (m.savingTravel || 0), 0)
    const gastadoViajes = detail.travels.reduce((s, t) => s + t.amount, 0)
    const ahorroAnual = mesesGeneral + extrasTotal
    const conAhorro = monthsDraft.filter((m) => (m.savingGeneral || 0) > 0)
    const restantes = monthsDraft.map(restanteDe).filter((r): r is number => r !== null && r >= 0)
    return {
      extrasTotal, ahorroAnual, ahorroViajes, gastadoViajes,
      quedaViajes: ahorroViajes - gastadoViajes,
      capitalFinal: detail.year.initialCapital + ahorroAnual,
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

  const onCreateYear = async () => {
    if (await run(createYear({ year: nuevo.year, initialCapital: nuevo.capital, goal: nuevo.goal }), `Año ${nuevo.year} creado`)) {
      setModalNuevo(false)
      setNuevo((n) => ({ ...n, capital: null, goal: null }))
      router.push(`/app/finance?year=${nuevo.year}`)
    }
  }

  const onEditYear = async () => {
    if (!detail) return
    if (await run(updateYear(detail.year.uuid, { year: editar.year, initialCapital: editar.capital, goal: editar.goal }), 'Año actualizado')) {
      setModalEditar(false)
      router.push(`/app/finance?year=${editar.year}`)
    }
  }

  const onDeleteYear = async () => {
    if (!detail) return
    if (await run(deleteYear(detail.year.uuid), `Año ${detail.year.year} eliminado`)) {
      setModalEliminar(false)
      router.push('/app/finance')
    }
  }

  const onCapitalBlur = async () => {
    if (!detail || capitalDraft === null || capitalDraft === detail.year.initialCapital) return
    await run(updateYear(detail.year.uuid, { initialCapital: capitalDraft }))
  }

  const onGoalSave = async (value: number | null) => {
    setEditingGoal(false)
    if (!detail || value === detail.year.goal) return
    await run(updateYear(detail.year.uuid, { goal: value }))
  }

  const goal = detail?.year.goal ?? null
  const goalPct = goal && resumen ? Math.round((resumen.ahorroAnual / goal) * 100) : 0

  const kpis = resumen
    ? [
        { label: 'Ahorro mensual medio', value: eur(resumen.kpiMedioMensual), Icon: TrendingUp },
        { label: 'Meses con ahorro', value: `${Math.round(resumen.kpiMesesAhorro * 100)}%`, Icon: CalendarCheck },
        { label: 'Dependencia de extras', value: resumen.kpiDependenciaExtras === null ? '—' : `${Math.round(resumen.kpiDependenciaExtras * 100)}%`, Icon: Gift },
        { label: 'Margen personal medio', value: eur(resumen.kpiMargenMedio), Icon: Wallet },
        { label: 'Ritmo de viajes', value: resumen.kpiRitmoViajes === null ? '—' : `${Math.round(resumen.kpiRitmoViajes * 100)}%`, Icon: Compass },
      ]
    : []

  const thClass = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground'
  const tdClass = 'px-3 py-1.5'

  return (
    <div>
      {/* Barra del año: selector + acciones */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <select
          className={cn(inputClass, 'w-27.5')}
          value={detail?.year.year ?? ''}
          onChange={(e) => router.push(`/app/finance?year=${e.target.value}`)}>
          {years.map((y) => (
            <option key={y.uuid} value={y.year}>{y.year}</option>
          ))}
        </select>
        <button
          type="button"
          className={btnOutline}
          onClick={() => {
            setNuevo({ year: (years[years.length - 1]?.year ?? new Date().getFullYear() - 1) + 1, capital: null, goal: null })
            setModalNuevo(true)
          }}>
          <Plus className="size-4" /> Nuevo año
        </button>
        {detail && (
          <>
            <button
              type="button"
              className={btnOutline}
              onClick={() => {
                setEditar({ year: detail.year.year, capital: detail.year.initialCapital, goal: detail.year.goal })
                setModalEditar(true)
              }}>
              <Pencil className="size-4" /> Editar año
            </button>
            <button type="button" className={btnDanger} onClick={() => setModalEliminar(true)}>
              <Trash2 className="size-4" /> Eliminar año
            </button>
          </>
        )}
      </div>

      {!detail || !resumen ? (
        <div className={cn(cardClass, 'py-16 text-center text-muted-foreground')}>
          Todavía no hay ningún año. Crea el primero para empezar a ahorrar.
        </div>
      ) : (
        <>
          {/* Resumen del año */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={cn(cardClass, 'p-5')}>
              <p className="mb-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
                <Landmark className="size-4 text-primary" /> Capital inicial
              </p>
              <NumInput value={capitalDraft} onChange={setCapitalDraft} />
              {capitalDraft !== detail.year.initialCapital && (
                <button type="button" className={cn(btnPrimary, 'mt-2 w-full')} onClick={onCapitalBlur}>
                  Guardar capital
                </button>
              )}
            </div>
            {[
              { title: 'Ahorro general anual', value: resumen.ahorroAnual, Icon: TrendingUp, color: 'text-success' },
              { title: 'Ahorro para viajes', value: resumen.ahorroViajes, Icon: Compass, color: 'text-viajes' },
              { title: 'Capital final proyectado', value: resumen.capitalFinal, Icon: LineChart, color: 'text-primary', bold: true },
            ].map((s) => (
              <div key={s.title} className={cn(cardClass, 'p-5')}>
                <p className="mb-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
                  <s.Icon className={cn('size-4', s.color)} /> {s.title}
                </p>
                <p className={cn('text-2xl font-semibold', s.bold && 'text-primary')}>{eur(s.value)}</p>
              </div>
            ))}
          </div>

          {/* Objetivo anual con barra de progreso */}
          <div className={cn(cardClass, 'mt-4 px-5 py-3.5')}>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="flex items-center gap-2 font-semibold">
                <Target className="size-4 text-primary" />
                Objetivo anual
                {goal !== null && !editingGoal && <span className="font-medium text-muted-foreground">{eur(goal)}</span>}
              </span>
              {editingGoal ? (
                <div className="flex w-45 gap-1.5">
                  <NumInput autoFocus value={goalDraft} onChange={setGoalDraft} placeholder="Sin objetivo" onEnter={() => onGoalSave(goalDraft)} />
                  <button type="button" className={btnIcon} onClick={() => onGoalSave(goalDraft)} aria-label="Guardar objetivo">
                    <Check className="size-4 text-success" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={cn(btnIcon, 'flex items-center gap-1.5 text-sm')}
                  onClick={() => { setGoalDraft(goal); setEditingGoal(true) }}>
                  <Pencil className="size-3.5" />
                  {goal === null ? 'Fijar objetivo' : 'Editar'}
                </button>
              )}
            </div>
            {goal !== null && (
              <>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all', goalPct >= 100 ? 'bg-success' : 'bg-primary')}
                    style={{ width: `${Math.min(100, goalPct)}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[12.5px] text-muted-foreground">
                  <span>{eur(resumen.ahorroAnual)} de {eur(goal)} ({goalPct}%)</span>
                  <span>{goalPct >= 100 ? '🎉 Objetivo cumplido' : `Faltan ${eur(goal - resumen.ahorroAnual)}`}</span>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[15fr_9fr]">
            {/* Control mensual + evolución */}
            <div>
              <div className={cardClass}>
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h3 className="font-semibold">Control mensual</h3>
                  <button type="button" className={btnPrimary} disabled={!dirty || saving} onClick={onSaveMonths}>
                    <Save className="size-4" />
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
                <div className="overflow-x-auto">
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
                        return (
                          <tr key={m.month} className="border-b border-border/50">
                            <td className={cn(tdClass, 'sticky left-0 z-10 border-r border-border/60 bg-card font-semibold')}>
                              {MESES[m.month - 1]}
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
                                <span className="text-muted-foreground/50">—</span>
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
              </div>

              <div className={cn(cardClass, 'mt-4')}>
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h3 className="font-semibold">Evolución mensual</h3>
                  <span className="text-[12.5px] text-muted-foreground">
                    <span className="mr-1.5 inline-block size-2.5 rounded-[3px] bg-primary" />General
                    <span className="ml-3.5 mr-1.5 inline-block size-2.5 rounded-[3px] bg-viajes" />Viajes
                  </span>
                </div>
                {/* overflow-x: en móvil la gráfica scrollea en vez de encogerse hasta ser ilegible */}
                <div className="overflow-x-auto px-4 py-3">
                  <MonthlyChart months={monthsDraft} />
                </div>
              </div>
            </div>

            {/* Columna derecha: extras, viajes y KPIs */}
            <div>
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
                <ConceptForm placeholder="Concepto (paga extra, bonus...)" onAdd={(datos) => run(addExtra(detail.year.uuid, datos))} />
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
                  withDate
                  onDelete={(uuid) => run(deleteTravel(uuid))}
                  onUpdate={(uuid, datos) => run(updateTravel(uuid, datos))}
                />
                <ConceptForm placeholder="Concepto (vuelos, hotel...)" withDate onAdd={(datos) => run(addTravel(detail.year.uuid, datos))} />
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

          {/* Resumen general de todos los años */}
          <div className={cn(cardClass, 'mt-4')}>
            <h3 className="border-b border-border px-5 py-3 font-semibold">Resumen general</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-160 text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className={thClass}>Año</th>
                    <th className={cn(thClass, 'text-right')}>Capital inicial</th>
                    <th className={cn(thClass, 'text-right')}>Ahorro general</th>
                    <th className={cn(thClass, 'text-right')}>Objetivo</th>
                    <th className={cn(thClass, 'text-right')}>Ahorro viajes</th>
                    <th className={cn(thClass, 'text-right')}>Capital final</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.uuid} className="border-b border-border/50">
                      <td className={cn(tdClass, 'py-2.5 font-semibold')}>{y.year}</td>
                      <td className={cn(tdClass, 'text-right')}>{eur(y.initialCapital)}</td>
                      <td className={cn(tdClass, 'text-right')}>{eur(ahorroAnualDe(y))}</td>
                      <td className={cn(tdClass, 'text-right')}>
                        {y.goal ? `${Math.round((ahorroAnualDe(y) / y.goal) * 100)}% de ${eur(y.goal)}` : '—'}
                      </td>
                      <td className={cn(tdClass, 'text-right')}>{eur(y.monthsTravel)}</td>
                      <td className={cn(tdClass, 'text-right font-semibold text-primary')}>{eur(capitalFinalDe(y))}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/50 font-semibold">
                    <td className={tdClass}>TOTAL</td>
                    <td className={tdClass} />
                    <td className={cn(tdClass, 'text-right')}>{eur(years.reduce((s, y) => s + ahorroAnualDe(y), 0))}</td>
                    <td className={tdClass} />
                    <td className={cn(tdClass, 'text-right')}>{eur(years.reduce((s, y) => s + y.monthsTravel, 0))}</td>
                    <td className={cn(tdClass, 'text-right')}>
                      {years.length ? eur(capitalFinalDe(years[years.length - 1])) : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {years.length > 1 && (
              <div className="overflow-x-auto border-t border-border px-4 pb-2 pt-4">
                <p className="mb-2 text-[13px] font-semibold text-muted-foreground">Capital acumulado</p>
                <CapitalChart years={years} capitalFinalDe={capitalFinalDe} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Alta de un año nuevo */}
      <Modal title="Nuevo año de ahorro" open={modalNuevo} onClose={() => setModalNuevo(false)} onOk={onCreateYear} okText="Crear">
        <div className="flex flex-col gap-3">
          <Field label="Año">
            <NumInput value={nuevo.year} onChange={(v) => setNuevo((n) => ({ ...n, year: v ?? new Date().getFullYear() }))} />
          </Field>
          <Field label="Capital inicial (vacío = se encadena con el capital final del año anterior)">
            <NumInput value={nuevo.capital} onChange={(v) => setNuevo((n) => ({ ...n, capital: v }))} placeholder="Automático" />
          </Field>
          <Field label="Objetivo de ahorro anual (opcional)">
            <NumInput value={nuevo.goal} onChange={(v) => setNuevo((n) => ({ ...n, goal: v }))} placeholder="Sin objetivo" />
          </Field>
        </div>
      </Modal>

      {/* Edición del año seleccionado */}
      {detail && (
        <>
          <Modal title={`Editar ${detail.year.year}`} open={modalEditar} onClose={() => setModalEditar(false)} onOk={onEditYear}>
            <div className="flex flex-col gap-3">
              <Field label="Año">
                <NumInput value={editar.year} onChange={(v) => setEditar((d) => ({ ...d, year: v ?? d.year }))} />
              </Field>
              <Field label="Capital inicial">
                <NumInput value={editar.capital} onChange={(v) => setEditar((d) => ({ ...d, capital: v }))} />
              </Field>
              <Field label="Objetivo de ahorro anual (vacío = sin objetivo)">
                <NumInput value={editar.goal} onChange={(v) => setEditar((d) => ({ ...d, goal: v }))} placeholder="Sin objetivo" />
              </Field>
            </div>
          </Modal>

          <Modal
            title={`¿Eliminar ${detail.year.year}?`}
            open={modalEliminar}
            onClose={() => setModalEliminar(false)}
            onOk={onDeleteYear}
            okText="Eliminar"
            okDanger>
            <p className="text-sm text-muted-foreground">
              Se eliminará el año {detail.year.year} con todo su detalle: control mensual,
              ingresos extraordinarios y gastos de viaje. Esta acción no se puede deshacer.
            </p>
          </Modal>
        </>
      )}
    </div>
  )
}
