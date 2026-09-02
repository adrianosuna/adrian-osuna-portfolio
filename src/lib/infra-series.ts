// Forma y cálculos de las series del monitor de infraestructura.
//
// NO lleva `server-only` a propósito: el tipo y la tendencia los usan el
// muestreo (servidor, `infra-historico.ts`) y las tarjetas de la pestaña
// Servidor (cliente), y duplicarlos es justo cómo se desincronizan — mismo
// criterio que `topes.ts`, `recurrentes.ts` y `fechas.ts`. Lo que toca Prisma
// vive en `infra-historico.ts`, que sí es de servidor.

/** Una muestra diaria del monitor, en tipos planos y serializables. */
export interface MuestraInfra {
  fecha: string // 'YYYY-MM-DD'
  discoPct: number | null
  dbBytes: number | null
  sslDias: number | null
  backupHoras: number | null
  dbLatenciaMs: number | null
  webTtfbMs: number | null
  memoriaPct: number | null
  cpuPct: number | null
}

/** Campos numéricos de una muestra (todos menos la fecha). */
export type CampoMuestra = keyof Omit<MuestraInfra, 'fecha'>

/**
 * Variación de una serie entre su primera y su última muestra CON dato.
 *
 * Es lo que convierte la gráfica en una frase ("el disco ha subido 4 puntos en
 * 90 días"). Null con menos de dos muestras útiles: con una sola no hay
 * tendencia que contar, y los días se miden entre las muestras reales (no entre
 * los extremos de la ventana) para no inventar un periodo que no se midió.
 */
export function tendencia(
  muestras: MuestraInfra[],
  campo: CampoMuestra,
): { desde: number; hasta: number; delta: number; dias: number } | null {
  const conDato = muestras.filter((m) => m[campo] !== null)
  if (conDato.length < 2) return null
  const primera = conDato[0]
  const ultima = conDato[conDato.length - 1]
  const desde = primera[campo] as number
  const hasta = ultima[campo] as number
  const dias = Math.round(
    (Date.parse(`${ultima.fecha}T00:00:00Z`) - Date.parse(`${primera.fecha}T00:00:00Z`)) /
      86_400_000,
  )
  return { desde, hasta, delta: hasta - desde, dias }
}

/**
 * Serie de un campo lista para pintar, arrastrando el último valor conocido en
 * los huecos.
 *
 * Un día cuyo check falló guarda null; dibujarlo como cero haría que la línea
 * se desplomara y volviera a subir, que se lee como una caída real del disco o
 * de la BD. Arrastrar el valor anterior dice la verdad: no hubo medida nueva.
 */
export function serieDe(muestras: MuestraInfra[], campo: CampoMuestra): number[] {
  let ultimo = 0
  return muestras.map((m) => {
    const v = m[campo]
    if (v !== null) ultimo = v
    return ultimo
  })
}
