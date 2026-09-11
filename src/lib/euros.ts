// Formato de importes, sin `server-only`: lo usan cliente y servidor. Decimales solo
// si el importe los tiene; `useGrouping: 'always'` porque es-ES no agrupa 4 cifras.

/** Importe redondeado a céntimos (evita el ruido binario: 100.00000001). */
const aCentimos = (v: number) => Math.round(v * 100)

/** ¿Tiene céntimos distintos de cero? */
export const tieneCentimos = (v: number) => aCentimos(v) % 100 !== 0

/** Euros con decimales solo si los tiene: '12,50 €', '60 €', '1.234,56 €'.
 *  null/undefined/NaN → '—'. */
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

/** Euros sin decimales, redondeados ('1.374 €'), solo para la cifra grande de un
 *  KPI: a 24 px los céntimos ensucian. En tablas y listas se quedan. */
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

/** Igual que `eur` sin el símbolo, para ejes de gráficas y celdas con el € en la
 *  cabecera. */
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
