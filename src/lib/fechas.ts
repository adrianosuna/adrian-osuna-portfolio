// Nombres de días y meses en español (ÚNICA fuente de verdad) y la aritmética
// de meses que comparten mantenimiento y recurrentes.
//
// Había diez copias repartidas por el proyecto (`MESES`, `MESES_CORTOS`,
// `MESES_LARGOS`, `MESES_CAL`, `MONTHS`), unas en minúscula y otras en
// mayúscula. Los meses van SIN abreviar y con inicial mayúscula; donde no
// caben (los ejes de doce meses), se recorta con `mesCorto` o su inicial, que
// se derivan de aquí en vez de duplicar la lista.
//
// Sin dependencias ni `server-only`: lo usan tanto el servidor (exportación a
// Excel, avisos del cron) como el cliente (gráficas, calendario, tablas).

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const

export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const

/** Nombre del mes por número 1-12 ('Agosto'). */
export const nombreMes = (mes: number) => MESES[mes - 1] ?? ''

/** Abreviatura de tres letras por índice 0-11 ('Ago'), para ejes estrechos. */
export const mesCorto = (i: number) => MESES[i]?.slice(0, 3) ?? ''

/** Inicial del mes por índice 0-11 ('A'), para cuando no caben ni tres letras. */
export const mesInicial = (i: number) => MESES[i]?.[0] ?? ''

// ─────────── aritmética de meses ───────────

const pad = (n: number) => String(n).padStart(2, '0')

/** Último día del mes (año y mes 1-12). */
const ultimoDia = (year: number, mes: number) => new Date(Date.UTC(year, mes, 0)).getUTCDate()

/**
 * Suma meses a una fecha 'YYYY-MM-DD' recortando al último día del mes destino
 * (31 de enero + 1 mes = 28 o 29 de febrero, no 3 de marzo).
 *
 * Con `ancla` (1-31) el día NO se hereda recortado: sirve para las series de
 * cargos, donde un recibo del 31 pasa por febrero y tiene que volver al 31 en
 * marzo. Sin ancla, se usa el día de la propia fecha.
 *
 * Está aquí porque la usan dos dominios —el vencimiento de las tareas de
 * mantenimiento y la fecha de los cargos recurrentes— y tener dos copias es
 * justo cómo se separan.
 */
export function sumarMeses(fechaIso: string, meses: number, ancla?: number): string {
  const [y, m, d] = fechaIso.split('-').map(Number)
  const total = m - 1 + meses
  const year = y + Math.floor(total / 12)
  const mes = (((total % 12) + 12) % 12) + 1
  const dia = Math.min(ancla ?? d, ultimoDia(year, mes))
  return `${year}-${pad(mes)}-${pad(dia)}`
}
