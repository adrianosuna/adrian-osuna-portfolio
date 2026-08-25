// Capa de datos del módulo de finanzas (solo servidor).
// Semántica (heredada del Excel "Ahorro Anual"):
//   - Ahorro general anual = suma del ahorro general mensual + ingresos extra.
//   - Capital final = capital inicial + ahorro general anual (el ahorro de
//     viajes está destinado a gastarse, no engrosa el capital).
import 'server-only'
import { prisma } from '@/lib/prisma'

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))

export interface YearSummary {
  uuid: string
  year: number
  initialCapital: number
  goal: number | null
  monthsGeneral: number
  monthsTravel: number
  extrasTotal: number
  travelsTotal: number
}

export interface MonthRow {
  month: number
  income: number | null
  savingGeneral: number | null
  savingTravel: number | null
}

export interface ConceptRow {
  uuid: string
  concept: string
  amount: number
  expenseDate?: string | null // 'YYYY-MM-DD'
}

export interface YearDetail {
  year: { uuid: string; year: number; initialCapital: number; goal: number | null }
  months: MonthRow[]
  extras: ConceptRow[]
  travels: ConceptRow[]
}

// Resumen de todos los años con sus totales agregados (para el resumen general).
export async function listYears(): Promise<YearSummary[]> {
  const years = await prisma.savingYear.findMany({
    orderBy: { year: 'asc' },
    include: { months: true, extras: true, travelExpenses: true },
  })
  return years.map((y) => ({
    uuid: y.uuid,
    year: y.year,
    initialCapital: num(y.initialCapital),
    goal: y.goal === null ? null : num(y.goal),
    monthsGeneral: y.months.reduce((s, m) => s + num(m.savingGeneral), 0),
    monthsTravel: y.months.reduce((s, m) => s + num(m.savingTravel), 0),
    extrasTotal: y.extras.reduce((s, e) => s + num(e.amount), 0),
    travelsTotal: y.travelExpenses.reduce((s, t) => s + num(t.amount), 0),
  }))
}

// Detalle completo de un año (o null si no existe).
export async function getYearDetail(year: number): Promise<YearDetail | null> {
  const record = await prisma.savingYear.findUnique({
    where: { year },
    include: {
      months: { orderBy: { month: 'asc' } },
      extras: { orderBy: { id: 'asc' } },
      travelExpenses: { orderBy: { id: 'asc' } },
    },
  })
  if (!record) return null
  return {
    year: {
      uuid: record.uuid,
      year: record.year,
      initialCapital: num(record.initialCapital),
      goal: record.goal === null ? null : num(record.goal),
    },
    months: record.months.map((m) => ({
      month: m.month,
      income: m.income === null ? null : num(m.income),
      savingGeneral: m.savingGeneral === null ? null : num(m.savingGeneral),
      savingTravel: m.savingTravel === null ? null : num(m.savingTravel),
    })),
    extras: record.extras.map((e) => ({ uuid: e.uuid, concept: e.concept, amount: num(e.amount) })),
    travels: record.travelExpenses.map((t) => ({
      uuid: t.uuid,
      concept: t.concept,
      amount: num(t.amount),
      expenseDate: t.expenseDate ? t.expenseDate.toISOString().slice(0, 10) : null,
    })),
  }
}

// Ahorro general anual y capital final de un año del resumen.
export const ahorroAnualDe = (y: YearSummary) => y.monthsGeneral + y.extrasTotal
export const capitalFinalDe = (y: YearSummary) => y.initialCapital + ahorroAnualDe(y)
