// Nombres de días y meses en español: ÚNICA fuente de verdad.
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
