// Topes de gasto: límite mensual opcional por categoría y su estado en un mes. Sin
// `server-only`: los umbrales los comparten el correo y las barras del mes.

export interface TopeRow {
  uuid: string
  name: string
  /** Grupo al que pertenece, si es una subcategoría (para leer "Coche ›
   *  Gasolina" en la barra y no una "Gasolina" suelta). */
  parentUuid: string | null
  parentName: string | null
  color: string
  budget: number
  /** Gastado en la categoría Y en sus subcategorías: el tope de un grupo es
   *  el de todo lo que cuelga de él. */
  gastado: number
  /** Consumido en tanto por ciento, SIN recortar a 100 (puede pasarse). */
  pct: number
}

/** A partir de este consumo el tope está "al límite" (aviso ámbar). */
export const UMBRAL_LIMITE = 80

export type NivelTope = 'ok' | 'limite' | 'pasado'

/** Estado de un tope según lo consumido. */
export const nivelTope = (pct: number): NivelTope =>
  pct >= 100 ? 'pasado' : pct >= UMBRAL_LIMITE ? 'limite' : 'ok'

/** Movimiento mínimo que hace falta para repartir el gasto por categoría. */
interface Movimiento {
  type: 'INGRESO' | 'GASTO'
  amount: number
  categoryUuid: string | null
}

interface Categoria {
  uuid: string
  name: string
  /** Grupo al que pertenece (null = primer nivel). Obligatorio: hay que pasar todas las
   *  categorías del tipo, o el gasto de una hija sin tope no sumaría a su grupo. */
  parentUuid: string | null
  color: string
  type: 'INGRESO' | 'GASTO'
  budget: number | null
}

/** Estado de los topes de un mes, del más apurado al que más margen tiene. Solo
 *  gasto con tope > 0; las sin gasto salen a 0 %. */
export function topesDelMes(categorias: Categoria[], movimientos: Movimiento[]): TopeRow[] {
  const gastoPorCat = new Map<string, number>()
  for (const m of movimientos) {
    if (m.type !== 'GASTO' || m.categoryUuid === null) continue
    gastoPorCat.set(m.categoryUuid, (gastoPorCat.get(m.categoryUuid) ?? 0) + m.amount)
  }

  // Un solo nivel, como el esquema: las hijas no tienen hijas.
  const hijasDe = new Map<string, string[]>()
  const nombres = new Map(categorias.map((c) => [c.uuid, c.name]))
  for (const c of categorias) {
    if (!c.parentUuid) continue
    hijasDe.set(c.parentUuid, [...(hijasDe.get(c.parentUuid) ?? []), c.uuid])
  }
  // Lo gastado "en" una categoría incluye lo de sus subcategorías: el tope de
  // un grupo ("el coche, 200 al mes") cuenta el taller y la gasolina.
  const gastadoDe = (uuid: string) =>
    (gastoPorCat.get(uuid) ?? 0) +
    (hijasDe.get(uuid) ?? []).reduce((s, h) => s + (gastoPorCat.get(h) ?? 0), 0)

  return categorias
    .filter((c) => c.type === 'GASTO' && c.budget !== null && c.budget > 0)
    .map((c) => {
      const budget = c.budget as number
      const gastado = gastadoDe(c.uuid)
      return {
        uuid: c.uuid,
        name: c.name,
        parentUuid: c.parentUuid,
        parentName: c.parentUuid ? nombres.get(c.parentUuid) ?? null : null,
        color: c.color,
        budget,
        gastado,
        pct: (gastado / budget) * 100,
      }
    })
    .sort((a, b) => b.pct - a.pct)
}

export interface ResumenTopes {
  /** Suma de los topes. */
  total: number
  /** Gastado dentro de las categorías CON tope (no el gasto del mes entero). */
  gastado: number
  /** total − gastado; negativo si se ha pasado en conjunto. */
  restante: number
  pasados: number
  alLimite: number
}

/** Cifras de cabecera. Los topes anidados no se suman dos veces: el techo es el del
 *  grupo. Los contadores sí cuentan todos. */
export function resumenTopes(topes: TopeRow[]): ResumenTopes {
  const conTope = new Set(topes.map((t) => t.uuid))
  const raiz = topes.filter((t) => !(t.parentUuid && conTope.has(t.parentUuid)))
  const total = raiz.reduce((s, t) => s + t.budget, 0)
  const gastado = raiz.reduce((s, t) => s + t.gastado, 0)
  return {
    total,
    gastado,
    restante: total - gastado,
    pasados: topes.filter((t) => nivelTope(t.pct) === 'pasado').length,
    alLimite: topes.filter((t) => nivelTope(t.pct) === 'limite').length,
  }
}
