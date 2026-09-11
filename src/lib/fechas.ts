// Nombres de días y meses en español, fuente única, y la aritmética de meses de
// mantenimiento y recurrentes. Sin abreviar; las abreviaturas se derivan. Sin server-only.

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

/** Abreviatura de tres letras del día ('Lun'), para el calendario en móvil. La
 *  inicial no sirve: Martes y Miércoles comparten la M. */
export const diaCorto = (i: number) => DIAS[i]?.slice(0, 3) ?? ''

// ─────────── aritmética de meses ───────────

const pad = (n: number) => String(n).padStart(2, '0')

/** Último día del mes (año y mes 1-12). */
const ultimoDia = (year: number, mes: number) => new Date(Date.UTC(year, mes, 0)).getUTCDate()

/** Suma meses a 'YYYY-MM-DD' recortando al último día del mes destino. Con `ancla`
 *  (1-31) el día no se hereda recortado: un recibo del 31 vuelve al 31 tras febrero. */
/** Suma (o resta) DÍAS a una fecha ISO. Sobre UTC para que no la mueva el
 *  horario de verano: aquí la fecha es un día del calendario, no un instante. */
export function sumarDias(fechaIso: string, dias: number): string {
  const [y, m, d] = fechaIso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10)
}

export function sumarMeses(fechaIso: string, meses: number, ancla?: number): string {
  const [y, m, d] = fechaIso.split('-').map(Number)
  const total = m - 1 + meses
  const year = y + Math.floor(total / 12)
  const mes = (((total % 12) + 12) % 12) + 1
  const dia = Math.min(ancla ?? d, ultimoDia(year, mes))
  return `${year}-${pad(mes)}-${pad(dia)}`
}
