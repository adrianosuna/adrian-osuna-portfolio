// Formato de importes en euros del módulo de finanzas (ahorro y gastos).
//
// NO lleva `server-only`: lo usan las vistas (cliente) y el inicio del
// dashboard (servidor), y tener dos copias es justo cómo se desincronizan —
// mismo criterio que `fechas.ts`, `topes.ts` y `recurrentes.ts`. Había tres
// copias de este formateador repartidas antes de unificarlo (02/09/2026).
//
// REGLA DE DECIMALES: se muestran **solo si el importe los tiene**. Un gasto de
// 12,50 € se ve entero ("12,50 €") en vez de redondeado a 13 €, que era lo que
// pasaba antes y descuadraba las cuentas a ojo; y uno de 60 € se ve "60 €", sin
// un ",00" que solo añade ruido en una columna de cifras redondas.
//
// `useGrouping: 'always'`: es-ES no agrupa los números de 4 cifras por defecto
// (daba "3950 €" junto a "12.750 €"); con esto siempre lleva punto de miles.

/** Importe redondeado a céntimos (evita el ruido binario: 100.00000001). */
const aCentimos = (v: number) => Math.round(v * 100)

/** ¿Tiene céntimos distintos de cero? */
export const tieneCentimos = (v: number) => aCentimos(v) % 100 !== 0

/**
 * Euros con decimales solo si los tiene: '12,50 €', '60 €', '1.234,56 €'.
 * null/undefined/NaN → '—'.
 */
export const eur = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  const decimales = tieneCentimos(v) ? 2 : 0
  return v.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: 'always',
  })
}

/**
 * Euros SIN decimales, redondeados: '1.374 €'. Para los KPI —la cifra grande
 * de una tarjeta— y solo para ellos.
 *
 * Es la excepción a la regla de arriba, y deliberada: en una cifra a 24 px los
 * céntimos no aportan lectura, la ensucian ("1.373,72 €" frente a "1.374 €"),
 * y nadie decide nada por 72 céntimos en un total del mes. En las tablas y
 * listas los decimales se QUEDAN, porque ahí sí descuadran las cuentas a ojo.
 * null/undefined/NaN → '—'.
 */
export const eurEntero = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return Math.round(v).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: 'always',
  })
}

/**
 * Igual que `eur` pero SIN el símbolo de moneda (para ejes de gráficas y
 * celdas donde el € se repite en la cabecera).
 */
export const num = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  const decimales = tieneCentimos(v) ? 2 : 0
  return v.toLocaleString('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: 'always',
  })
}

/** Redondea un importe a céntimos: lo que se guarda en un DECIMAL(12,2). */
export const redondearCentimos = (v: number) => aCentimos(v) / 100
