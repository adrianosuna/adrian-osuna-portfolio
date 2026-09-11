// Forma y cálculos de las series del monitor, sin `server-only`: los comparten el
// muestreo (servidor) y las tarjetas (cliente). Lo que toca Prisma va en `infra-historico.ts`.

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

/** Variación de una serie entre su primera y su última muestra con dato. Null con
 *  menos de dos; los días se miden entre muestras reales, no entre los extremos. */
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

/** Serie de un campo lista para pintar, arrastrando el último valor en los huecos:
 *  un null dibujado como cero se leería como una caída real. */
export function serieDe(muestras: MuestraInfra[], campo: CampoMuestra): number[] {
  let ultimo = 0
  return muestras.map((m) => {
    const v = m[campo]
    if (v !== null) ultimo = v
    return ultimo
  })
}
