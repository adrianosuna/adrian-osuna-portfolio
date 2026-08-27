// Capa de datos del módulo de finanzas (solo servidor).
// Semántica del ahorro anual:
//   - Ahorro anual = ahorro general mensual + ingresos extra + SOBRANTE de
//     viajes (ahorrado - gastado): al cerrar el año, lo que no se gastó en
//     viajes se suma al ahorro y el año siguiente empieza de cero.
// (El capital inicial/final se retiró el 26/08/2026: solo se controla el ahorro.)
import 'server-only'
import { prisma } from '@/lib/prisma'
import { botonHtml, correoConfigurado, enviarCorreo, tarjetaHtml } from '@/lib/correo'
import { hoyMadrid } from '@/lib/mantenimiento'
import { SITE_URL } from '@/lib/site'

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))

export interface YearSummary {
  uuid: string
  year: number
  goal: number | null
  incomeTotal: number
  monthsGeneral: number
  monthsTravel: number
  extrasTotal: number
  travelsTotal: number
  /** Ahorro general de los 12 meses (null = mes sin rellenar). Permite
   *  comparar años a la misma altura y proyectar el año en curso. */
  generalPorMes: Array<number | null>
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
}

export interface YearDetail {
  year: { uuid: string; year: number; goal: number | null }
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
    goal: y.goal === null ? null : num(y.goal),
    incomeTotal: y.months.reduce((s, m) => s + num(m.income), 0),
    monthsGeneral: y.months.reduce((s, m) => s + num(m.savingGeneral), 0),
    monthsTravel: y.months.reduce((s, m) => s + num(m.savingTravel), 0),
    extrasTotal: y.extras.reduce((s, e) => s + num(e.amount), 0),
    travelsTotal: y.travelExpenses.reduce((s, t) => s + num(t.amount), 0),
    generalPorMes: Array.from({ length: 12 }, (_, i) => {
      const m = y.months.find((x) => x.month === i + 1)
      return m?.savingGeneral === null || m?.savingGeneral === undefined ? null : num(m.savingGeneral)
    }),
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
    })),
  }
}

// Ahorro anual de un año del resumen: mensual + extras + sobrante de viajes
// (si se gastó más de lo ahorrado para viajes, el exceso resta).
export const ahorroAnualDe = (y: YearSummary) =>
  y.monthsGeneral + y.extrasTotal + (y.monthsTravel - y.travelsTotal)

// ─────────── Recordatorio de mes sin rellenar (cron diario) ───────────

const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Año y mes del mes natural anterior a una fecha ISO ('2027-01-15' → 2026/12). */
export function mesAnterior(hoyIso: string): { year: number; month: number } {
  const [y, m] = hoyIso.split('-').map(Number)
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 }
}

/** Meses de 1 a `hasta` sin ningún dato (sin fila, o con los tres campos a null). */
export function mesesSinRellenar(
  months: Array<{ month: number; income: unknown; savingGeneral: unknown; savingTravel: unknown }>,
  hasta: number,
): number[] {
  const vacios: number[] = []
  for (let m = 1; m <= hasta; m++) {
    const fila = months.find((x) => x.month === m)
    if (!fila || (fila.income === null && fila.savingGeneral === null && fila.savingTravel === null)) {
      vacios.push(m)
    }
  }
  return vacios
}

/** Recordatorio por correo de meses sin rellenar: mira el año del mes natural
 *  anterior (en enero, el diciembre del año pasado) y avisa de todos sus meses
 *  cerrados y vacíos. Reaviso semanal vía `last_reminded`, no diario. Devuelve
 *  cuántos meses se avisaron. `hoyIso` se inyecta en tests. */
export async function avisarMesSinRellenar(hoyIso = hoyMadrid()): Promise<number> {
  if (!correoConfigurado()) return 0
  const { year, month } = mesAnterior(hoyIso)
  const registro = await prisma.savingYear.findUnique({ where: { year }, include: { months: true } })
  if (!registro) return 0

  const vacios = mesesSinRellenar(registro.months, month)
  if (!vacios.length) return 0
  const hace7dias = new Date(Date.now() - 7 * 86_400_000)
  if (registro.lastReminded && registro.lastReminded > hace7dias) return 0

  const nombres = vacios.map((m) => MESES_LARGOS[m - 1]).join(', ')
  await enviarCorreo(
    `✍ Ahorro ${year}: ${vacios.length === 1 ? 'un mes sin rellenar' : `${vacios.length} meses sin rellenar`}`,
    `<p style="margin:0 0 14px">El control mensual del ahorro tiene meses ya cerrados sin rellenar:</p>
     ${tarjetaHtml(`Ahorro ${year}`, `Sin rellenar: ${nombres}`, null, vacios.length > 1)}
     ${botonHtml('Abrir Finanzas', `${SITE_URL}/app/finance?year=${year}`)}
     <p style="margin:14px 0 0;font-size:12px;color:#64766f">Rellena los meses (o déjalos a cero) y el
     aviso desaparece. Se repite semanalmente mientras siga pendiente.</p>`,
  )

  await prisma.savingYear.update({
    where: { uuid: registro.uuid },
    data: { lastReminded: new Date() },
  })
  return vacios.length
}
