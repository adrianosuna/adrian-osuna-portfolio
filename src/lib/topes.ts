// Topes de gasto por categoría: el límite MENSUAL opcional de cada categoría
// de gasto y su estado en un mes.
//
// Por qué existen: los donuts del control de gastos cuentan lo que ya pasó, y
// un gasto ya hecho no se puede deshacer. El tope es la misma información
// llegando A TIEMPO — mientras el mes corre y todavía se puede decidir.
//
// Sin `server-only` ni dependencias a propósito: los umbrales y el cálculo del
// estado los necesitan el aviso por correo (servidor) y las barras de la vista
// del mes (cliente), y duplicar los umbrales en los dos lados es justo cómo se
// desincronizan.

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
  /** Grupo al que pertenece (null = primer nivel). Obligatorio a propósito:
   *  quien llame tiene que pasar TODAS las categorías del tipo, no solo las
   *  que tienen tope — si no, el gasto de una subcategoría sin tope no se
   *  podría sumar al tope de su grupo y este saldría siempre a cero. */
  parentUuid: string | null
  color: string
  type: 'INGRESO' | 'GASTO'
  budget: number | null
}

/**
 * Estado de todos los topes de un mes, del más apurado al que más margen le
 * queda: lo primero que hay que ver es lo que está a punto de pasarse.
 *
 * Solo entran las categorías de GASTO con tope: un tope de 0 (o negativo) no
 * dice nada y se trata como "sin tope". Las que tienen tope y ningún gasto
 * salen igual, a 0 %, porque saber que aún no has tocado un sobre es la mitad
 * de la información.
 */
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

/**
 * Cifras de cabecera de los topes de un mes.
 *
 * ⚠ Los topes ANIDADOS no se suman dos veces: si "Coche" tiene tope y su
 * subcategoría "Gasolina" también, el techo del conjunto es el del grupo (la
 * gasolina ya va dentro), así que solo cuenta el del grupo. Sumar los dos
 * daría un presupuesto que no existe y un "restante" inflado.
 *
 * Los CONTADORES, en cambio, cuentan todos los topes: que la gasolina se haya
 * pasado importa aunque el coche en conjunto siga bajo su límite.
 */
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
