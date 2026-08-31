// Utilidades compartidas del módulo de finanzas (lado cliente): formato de
// euros, fórmulas del resumen anual y clases/piezas de UI comunes. Las
// fórmulas duplican a propósito las de lib/finance.ts (server-only: un
// componente cliente no puede importarlas).
import type { YearSummary } from '@/lib/finance'

// Formato de importes: euros sin decimales (mismo criterio que el Excel).
// `useGrouping: 'always'`: es-ES no agrupa los números de 4 cifras por defecto
// (daba "3950 €" junto a "12.750 €"); con esto siempre lleva punto de miles.
export const eur = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v)
    ? '—'
    : v.toLocaleString('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
        useGrouping: 'always',
      })

// Ahorro anual = mensual + extras + sobrante de viajes (lo no gastado en
// viajes se suma al cierre; si se gastó de más, el exceso resta).
export const ahorroAnualDe = (y: YearSummary) =>
  y.monthsGeneral + y.extrasTotal + (y.monthsTravel - y.travelsTotal)

/**
 * Tasa de ahorro: qué parte de lo ingresado se ahorra (null sin ingresos).
 * Los ingresos extraordinarios cuentan en AMBOS lados: son ahorro, pero
 * también son ingresos. Dejándolos solo arriba la tasa se inflaba y podía
 * pasar del 100% (imposible: no se ahorra más de lo que entra).
 */
export const tasaAhorroDe = (y: YearSummary) => {
  const ingresos = y.incomeTotal + y.extrasTotal
  return ingresos > 0 ? ahorroAnualDe(y) / ingresos : null
}

/** Formato de tasa: '34 %' o '—'. El porcentaje va con espacio (norma RAE) y
 *  lo pone Intl, que en es-ES usa un espacio IRROMPIBLE: la cifra y el símbolo
 *  nunca se separan en un salto de línea. */
export const pct = (v: number | null) =>
  v === null ? '—' : v.toLocaleString('es-ES', { style: 'percent', maximumFractionDigits: 0 })

// ─────────── proyección del año en curso (fórmulas puras) ───────────

export interface ProyeccionAnual {
  /** Media de ahorro general de los meses rellenos; null sin datos. */
  mediaMensual: number | null
  /** Ahorro anual proyectado: lo actual + la media por los meses que faltan. */
  proyeccion: number | null
  /** €/mes necesarios en los meses que faltan para cumplir el objetivo;
   *  0 si ya está cumplido; null sin objetivo o sin meses por delante. */
  necesarioMensual: number | null
  /** Meses aún sin rellenar de aquí a diciembre (el actual incluido). */
  mesesFuturos: number
}

/** Proyección de fin de año a ritmo actual. `fijos` son los aportes que no
 *  dependen del mes (extras + sobrante de viajes). `mesActual` en 1-12; los
 *  meses pasados sin rellenar se dan por perdidos (no se ahorra hacia atrás). */
export function proyeccionDe(
  meses: Array<{ month: number; savingGeneral: number | null }>,
  fijos: number,
  goal: number | null,
  mesActual: number,
): ProyeccionAnual {
  const rellenos = meses.filter((m) => m.savingGeneral !== null)
  const mesesFuturos = meses.filter((m) => m.savingGeneral === null && m.month >= mesActual).length
  const conObjetivo = goal !== null && goal > 0

  if (!rellenos.length) {
    return {
      mediaMensual: null,
      proyeccion: null,
      necesarioMensual: conObjetivo && mesesFuturos > 0 ? (goal - fijos) / mesesFuturos : null,
      mesesFuturos,
    }
  }

  const mediaMensual = rellenos.reduce((s, m) => s + (m.savingGeneral || 0), 0) / rellenos.length
  const actual = rellenos.reduce((s, m) => s + (m.savingGeneral || 0), 0) + fijos
  const necesarioMensual = !conObjetivo
    ? null
    : actual >= goal
      ? 0
      : mesesFuturos === 0
        ? null
        : (goal - actual) / mesesFuturos

  return {
    mediaMensual,
    proyeccion: actual + mediaMensual * mesesFuturos,
    necesarioMensual,
    mesesFuturos,
  }
}

/** Objetivo prorrateado a hoy (por día del año natural): cuánto "deberías"
 *  llevar ahorrado a estas alturas. Años pasados: el objetivo completo;
 *  futuros: 0. */
export function esperadoHoy(goal: number, año: number, hoyIso: string): number {
  const añoHoy = Number(hoyIso.slice(0, 4))
  if (año < añoHoy) return goal
  if (año > añoHoy) return 0
  const inicio = Date.UTC(año, 0, 1)
  const dias = Math.floor((Date.parse(`${hoyIso}T00:00:00Z`) - inicio) / 86_400_000) + 1
  const total = (Date.UTC(año + 1, 0, 1) - inicio) / 86_400_000
  return goal * (dias / total)
}

// ─────────── piezas del control de gastos ───────────
// Aquí y no en gastos.tsx porque las comparten la vista de Gastos y la de
// Ajustes (categorías y recurrentes).

/** 'YYYY-MM-DD' → 'DD/MM'. */
export const fmtDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Fecha con el año SOLO si no es el del periodo que se está viendo: un cargo
 *  anual cae en otro año y "20/03" a secas no dice cuál. */
export const fmtDiaAnio = (iso: string, referencia: string) =>
  iso.slice(0, 4) === referencia.slice(0, 4) ? fmtDia(iso) : `${fmtDia(iso)}/${iso.slice(0, 4)}`

/** Color de "sin categoría" (el gris apagado del tema). */
export const SIN_CATEGORIA = '#94a3b8'

export const TIPOS: Array<{ value: 'INGRESO' | 'GASTO'; label: string }> = [
  { value: 'GASTO', label: 'Gasto' },
  { value: 'INGRESO', label: 'Ingreso' },
]

export const cardClass = 'rounded-xl border border-border bg-card'
export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
export const btnOutline =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary'
// p-2 (36px con icono): target táctil suficiente en móvil.
export const btnIcon = 'rounded-md p-2 max-sm:p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
