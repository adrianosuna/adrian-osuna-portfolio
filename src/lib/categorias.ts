// Presentación de las categorías con GRUPOS, compartida por el servidor y el
// cliente. Sin `server-only` a propósito, mismo criterio que `topes.ts` y
// `fechas.ts`: estas reglas las necesitan los desplegables de tres pantallas,
// la lista de Ajustes y el correo de los topes, y tenerlas duplicadas es justo
// cómo se desincronizan.
//
// La regla de fondo, de la que sale todo lo demás: los movimientos cuelgan
// SIEMPRE de una categoría. Un grupo ("Coche") es un contenedor: se crea
// vacío, agrupa, y no se apunta nunca.

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

/**
 * ¿Es un grupo? Los grupos no se ofrecen al apuntar, no se fusionan y no se
 * borran mientras tengan categorías dentro.
 *
 * ⚠ Se lee de la MARCA y no de "tiene hijas": un grupo recién creado está
 * vacío, y deducirlo lo dejaría en los desplegables de movimientos hasta que
 * alguien le metiera algo.
 */
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

/**
 * ÁRBOL de un desplegable de categoría para un tipo: "Sin categoría" primero,
 * después el primer nivel en su orden (grupos con sus categorías dentro y
 * sueltas), que ya es el orden en que llega `listCategorias`.
 *
 * Los grupos entran como CABECERA (con hijas), nunca como opción: no reciben
 * movimientos. Un grupo vacío se omite: una cabecera sin nada debajo solo
 * confunde. Es la misma regla que `opcionesDeCategoria` con otra forma; las
 * dos existen porque el disparador y el buscador necesitan la lista plana con
 * la ruta ("Coche › Taller") y la lista desplegada necesita el árbol.
 */
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

/**
 * Opciones PLANAS de un desplegable de categoría para un tipo, con la etiqueta
 * completa ("Coche › Taller"). Sin los GRUPOS: no reciben movimientos.
 *
 * Los desplegables de la interfaz usan el árbol (`arbolDeCategoria`); esta
 * forma queda para lo que necesita una lista lineal (la API, los textos).
 */
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
