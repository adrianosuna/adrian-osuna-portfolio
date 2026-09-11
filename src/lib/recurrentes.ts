// Movimientos recurrentes: la parte pura (fechas, periodicidades, cifras), compartida
// por el cron y la tarjeta del mes. Sin `server-only`.
import { sumarMeses } from '@/lib/fechas'

export type TipoMovimiento = 'INGRESO' | 'GASTO'

export interface RecurrenteRow {
  uuid: string
  type: TipoMovimiento
  concept: string
  amount: number
  /** Cada cuántos meses se repite. */
  intervalMonths: number
  /** Próximo cargo, 'YYYY-MM-DD'. */
  nextDate: string
  /** Día del mes original (1-31). */
  dayAnchor: number
  active: boolean
  /** Fecha del último movimiento generado, 'YYYY-MM-DD'. */
  lastCreated: string | null
  categoryUuid: string | null
  /** Nº de movimientos que ha apuntado y siguen existiendo. */
  generados: number
}

/** Periodicidades que se ofrecen. Cualquier número de meses vale en BD; estas
 *  son las que cubren todo lo que se paga de verdad. */
export const PERIODICIDADES = [
  { meses: 1, label: 'Cada mes' },
  { meses: 2, label: 'Cada 2 meses' },
  { meses: 3, label: 'Cada trimestre' },
  { meses: 6, label: 'Cada semestre' },
  { meses: 12, label: 'Cada año' },
] as const

/** Etiqueta de una periodicidad en meses. Los múltiplos de 12 se leen en años
 *  ("Cada 2 años"); el resto, en meses. */
export const etiquetaPeriodo = (meses: number) => {
  const fija = PERIODICIDADES.find((p) => p.meses === meses)
  if (fija) return fija.label
  if (meses > 12 && meses % 12 === 0) return `Cada ${meses / 12} años`
  return `Cada ${meses} meses`
}

/** Fecha del cargo siguiente al de `nextDate`. */
export const proximaFecha = (r: Pick<RecurrenteRow, 'nextDate' | 'intervalMonths' | 'dayAnchor'>) =>
  sumarMeses(r.nextDate, r.intervalMonths, r.dayAnchor)

/** Coste equivalente al mes: un seguro de 600 €/año son 50 €/mes. Sumar solo los
 *  mensuales dejaría fuera los recibos gordos. */
export const equivalenteMensual = (r: Pick<RecurrenteRow, 'amount' | 'intervalMonths'>) =>
  r.intervalMonths > 0 ? r.amount / r.intervalMonths : 0

export interface ResumenRecurrentes {
  /** Gasto equivalente al mes de los recurrentes activos. */
  gasto: number
  /** Ingreso equivalente al mes de los recurrentes activos. */
  ingreso: number
  /** ingreso − gasto: lo que queda comprometido cada mes. */
  neto: number
  activos: number
}

/** Cifras de cabecera de los recurrentes (solo cuentan los activos). */
export function resumenRecurrentes(filas: RecurrenteRow[]): ResumenRecurrentes {
  const activos = filas.filter((r) => r.active)
  const suma = (tipo: TipoMovimiento) =>
    activos.filter((r) => r.type === tipo).reduce((s, r) => s + equivalenteMensual(r), 0)
  const gasto = suma('GASTO')
  const ingreso = suma('INGRESO')
  return { gasto, ingreso, neto: ingreso - gasto, activos: activos.length }
}

/** Fechas a generar hasta `hoy` y la siguiente pendiente. Recupera los cargos
 *  atrasados con el freno de `MAX_CARGOS`: pasados esos, salta al primero futuro. */
export const MAX_CARGOS = 24

export function cargosPendientes(
  r: Pick<RecurrenteRow, 'nextDate' | 'intervalMonths' | 'dayAnchor'>,
  hoy: string,
): { fechas: string[]; siguiente: string; truncado: boolean } {
  // Sin periodo no hay recurrencia posible: sumar 0 meses no avanzaría nunca
  // y el bucle no terminaría.
  if (!(r.intervalMonths >= 1)) return { fechas: [], siguiente: r.nextDate, truncado: false }

  const fechas: string[] = []
  let cursor = r.nextDate
  while (cursor <= hoy && fechas.length < MAX_CARGOS) {
    fechas.push(cursor)
    cursor = sumarMeses(cursor, r.intervalMonths, r.dayAnchor)
  }
  // Si el freno ha saltado, se descartan los cargos viejos que quedaban.
  const truncado = cursor <= hoy
  while (cursor <= hoy) cursor = sumarMeses(cursor, r.intervalMonths, r.dayAnchor)
  return { fechas, siguiente: cursor, truncado }
}

/** Fechas en las que un recurrente carga en un mes, proyectadas desde `nextDate`.
 *  Para un mes pasado devuelve vacío: ahí la verdad son los movimientos apuntados. */
export function fechasEnMes(
  r: Pick<RecurrenteRow, 'nextDate' | 'intervalMonths' | 'dayAnchor'>,
  mes: string,
): string[] {
  if (!(r.intervalMonths >= 1)) return r.nextDate.startsWith(mes) ? [r.nextDate] : []
  const inicio = `${mes}-01`
  const fin = sumarMeses(inicio, 1)
  const fechas: string[] = []
  let cursor = r.nextDate
  // El freno es el mismo de `cargosPendientes`: protege de un intervalo
  // corrupto o de una fecha disparatada, no del uso normal.
  let saltos = 0
  const TOPE = MAX_CARGOS * 30
  while (cursor < inicio && saltos < TOPE) {
    cursor = sumarMeses(cursor, r.intervalMonths, r.dayAnchor)
    saltos++
  }
  while (cursor < fin && saltos < TOPE) {
    fechas.push(cursor)
    cursor = sumarMeses(cursor, r.intervalMonths, r.dayAnchor)
    saltos++
  }
  return fechas
}
