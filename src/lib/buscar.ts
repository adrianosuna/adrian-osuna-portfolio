// Forma de los resultados de la búsqueda global (la de la paleta ⌘K).
//
// Vive aparte de `app/app/buscar-actions.ts` porque ese fichero es `'use server'`
// y un módulo de server actions **solo puede exportar funciones async**: un tipo
// o una constante ahí dejan al módulo sin exports para el cliente (y el build
// falla al importarlos). Sin `server-only`: lo usan la action y la paleta.

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
