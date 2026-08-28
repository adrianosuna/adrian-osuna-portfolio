// Movimientos recurrentes: alquiler, suscripciones, seguros, la nómina... todo
// lo que cae siempre y hasta ahora había que teclear cada mes.
//
// Aquí vive solo la parte PURA (fechas, periodicidades y cifras): la usan el
// generador del cron en el servidor y la tarjeta de la vista del mes en el
// cliente. Sin `server-only`, como `topes.ts`; su única dependencia es la
// aritmética de meses de `fechas.ts`, compartida con mantenimiento.
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

/** Etiqueta de una periodicidad en meses ('Cada trimestre', 'Cada 4 meses'). */
export const etiquetaPeriodo = (meses: number) =>
  PERIODICIDADES.find((p) => p.meses === meses)?.label ?? `Cada ${meses} meses`

/** Fecha del cargo siguiente al de `nextDate`. */
export const proximaFecha = (r: Pick<RecurrenteRow, 'nextDate' | 'intervalMonths' | 'dayAnchor'>) =>
  sumarMeses(r.nextDate, r.intervalMonths, r.dayAnchor)

/**
 * Coste equivalente AL MES de un recurrente.
 *
 * Un seguro de 600 € al año no son 600 € al mes ni 0: son 50 €. Sumar solo los
 * mensuales dejaría fuera justo los recibos gordos, que casi nunca son
 * mensuales.
 */
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

/**
 * Fechas que hay que generar de un recurrente hasta `hoy` incluido, y la fecha
 * en la que se queda esperando el siguiente cargo.
 *
 * Normalmente es una sola fecha, pero si el servidor estuvo parado (o el
 * recurrente se dio de alta con la fecha atrasada) hay que recuperar todos los
 * cargos pendientes. `MAX_CARGOS` es el freno: pasados esos, el recurrente
 * salta al primer cargo futuro SIN apuntar el resto — si alguien pone la fecha
 * en 2019, lo que no se quiere es inundar el histórico con 80 movimientos.
 */
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
