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
  color: string
  budget: number
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

  return categorias
    .filter((c) => c.type === 'GASTO' && c.budget !== null && c.budget > 0)
    .map((c) => {
      const budget = c.budget as number
      const gastado = gastoPorCat.get(c.uuid) ?? 0
      return {
        uuid: c.uuid,
        name: c.name,
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

/** Cifras de cabecera de los topes de un mes. */
export function resumenTopes(topes: TopeRow[]): ResumenTopes {
  const total = topes.reduce((s, t) => s + t.budget, 0)
  const gastado = topes.reduce((s, t) => s + t.gastado, 0)
  return {
    total,
    gastado,
    restante: total - gastado,
    pasados: topes.filter((t) => nivelTope(t.pct) === 'pasado').length,
    alLimite: topes.filter((t) => nivelTope(t.pct) === 'limite').length,
  }
}
