// Utilidades cliente del módulo de finanzas: formato, fórmulas del resumen anual y
// piezas de UI. Las fórmulas duplican las de lib/finance.ts (server-only).
import type { YearSummary } from '@/lib/finance'

// Formato de importes: la fuente única es `lib/euros.ts`. Se re-exporta porque todo
// el módulo lo importa de `./comun`.
export { eur, eurEntero } from '@/lib/euros'

// Ahorro anual = mensual + extras + sobrante de viajes (lo no gastado en
// viajes se suma al cierre; si se gastó de más, el exceso resta).
export const ahorroAnualDe = (y: YearSummary) =>
  y.monthsGeneral + y.extrasTotal + (y.monthsTravel - y.travelsTotal)

/** Tasa de ahorro (null sin ingresos). Los extraordinarios cuentan en ambos lados:
 *  son ahorro y también ingresos; solo arriba, la tasa pasaba del 100 %. */
export const tasaAhorroDe = (y: YearSummary) => {
  const ingresos = y.incomeTotal + y.extrasTotal
  return ingresos > 0 ? ahorroAnualDe(y) / ingresos : null
}

/** Formato de tasa: '34 %' o '—'. El espacio (norma RAE) lo pone Intl y es
 *  irrompible: cifra y símbolo no se separan en un salto de línea. */
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

/** Proyección de fin de año a ritmo actual. `fijos` son extras + sobrante de
 *  viajes; `mesActual` en 1-12. Los meses pasados sin rellenar se dan por perdidos. */
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

/** Objetivo prorrateado a hoy por día del año natural. Años pasados: el objetivo
 *  completo; futuros: 0. */
export function esperadoHoy(goal: number, año: number, hoyIso: string): number {
  const añoHoy = Number(hoyIso.slice(0, 4))
  if (año < añoHoy) return goal
  if (año > añoHoy) return 0
  const inicio = Date.UTC(año, 0, 1)
  const dias = Math.floor((Date.parse(`${hoyIso}T00:00:00Z`) - inicio) / 86_400_000) + 1
  const total = (Date.UTC(año + 1, 0, 1) - inicio) / 86_400_000
  return goal * (dias / total)
}

// Piezas del control de gastos, aquí porque las comparten Gastos y Ajustes.

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
// La escala de botones vive en `ui/botones.ts` (fuente única: estaba copiada
// en cinco ficheros). Se re-exporta porque todo el módulo la importa de aquí.
export { btnPrimary, btnOutline, btnIcon, chipFiltro } from '@/components/ui/botones'
