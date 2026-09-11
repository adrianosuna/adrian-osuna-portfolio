// Presentación de las categorías con grupos, sin `server-only`: la comparten tres
// desplegables, Ajustes y el correo. Los movimientos cuelgan siempre de una categoría.

export type TipoCategoria = 'INGRESO' | 'GASTO'

/** Lo mínimo que hace falta saber de una categoría para presentarla. */
export interface CategoriaConGrupo {
  uuid: string
  name: string
  /** Si es un GRUPO en vez de una categoría. */
  isGroup: boolean
  /** Nombre de su grupo, o null si está suelta (o es ella misma un grupo). */
  parentName: string | null
  type: TipoCategoria
}

/** ¿Es un grupo? Se lee de la marca, no de "tiene hijas": un grupo recién creado
 *  está vacío y deducirlo lo dejaría en los desplegables. */
export const esGrupo = (c: { isGroup: boolean }) => c.isGroup

/** "Coche › Taller", o solo "Taller" si está suelta. */
export const etiquetaCategoria = (c: { name: string; parentName: string | null }) =>
  c.parentName ? `${c.parentName} › ${c.name}` : c.name

/** Nodo del desplegable en árbol (la forma que consume `TreeSelectField`). */
export interface NodoCategoria {
  value: string
  label: string
  /** Con hijas es un GRUPO: cabecera del árbol, no se elige. */
  hijos?: NodoCategoria[]
}

/** Árbol del desplegable de categoría: "Sin categoría", luego el primer nivel con
 *  grupos como cabecera (no opción) y sus hijas. Un grupo vacío se omite. */
export function arbolDeCategoria(
  categorias: Array<CategoriaConGrupo & { parentUuid: string | null }>,
  tipo: TipoCategoria,
): NodoCategoria[] {
  const delTipo = categorias.filter((c) => c.type === tipo)
  const nodos: NodoCategoria[] = [{ value: '', label: 'Sin categoría' }]
  for (const c of delTipo) {
    if (c.parentUuid) continue // va dentro de su grupo
    if (!esGrupo(c)) {
      nodos.push({ value: c.uuid, label: c.name })
      continue
    }
    const hijas = delTipo.filter((h) => h.parentUuid === c.uuid)
    if (hijas.length) {
      nodos.push({ value: c.uuid, label: c.name, hijos: hijas.map((h) => ({ value: h.uuid, label: h.name })) })
    }
  }
  return nodos
}

/** Opciones planas con la etiqueta completa ("Coche › Taller"), sin grupos. Para
 *  lo que necesita una lista lineal (la API, los textos); la UI usa el árbol. */
export function opcionesDeCategoria(
  categorias: CategoriaConGrupo[],
  tipo: TipoCategoria,
): Array<{ value: string; label: string }> {
  return [
    { value: '', label: 'Sin categoría' },
    ...categorias
      .filter((c) => c.type === tipo && !esGrupo(c))
      .map((c) => ({ value: c.uuid, label: etiquetaCategoria(c) })),
  ]
}
