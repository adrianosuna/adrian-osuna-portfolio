// Tipos de la búsqueda global. Aparte de `buscar-actions.ts` porque un módulo
// 'use server' solo puede exportar funciones async. Sin `server-only`.

/** Menos de esto no se consulta: con una letra sobran coincidencias. */
export const MINIMO_BUSQUEDA = 2

/** Cuántos resultados por grupo (la paleta es una lista corta, no un informe). */
export const POR_GRUPO = 5

export interface ResultadoGlobal {
  movimientos: Array<{
    uuid: string
    concepto: string
    importe: number
    /** 'YYYY-MM-DD' */
    fecha: string
    esGasto: boolean
  }>
  oportunidades: Array<{
    uuid: string
    titulo: string
    empresa: string | null
    estado: string
  }>
  notas: Array<{ uuid: string; titulo: string }>
}

export const RESULTADO_VACIO: ResultadoGlobal = {
  movimientos: [],
  oportunidades: [],
  notas: [],
}
