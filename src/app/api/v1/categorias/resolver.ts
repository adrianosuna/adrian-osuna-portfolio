// Resuelve la categoría de la API por uuid o por nombre (sin tildes ni mayúsculas):
// en un Atajo del iPhone se dice "Compra", no se pega un uuid.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { sinAcentos } from '@/lib/utils'

export type CategoriaResuelta = { error: string } | { uuid: string | null; nombre: string | null }

/** Separadores admitidos para una ruta "Coche > Gasolina" (el Atajo puede
 *  mandar cualquiera de los tres, y el de la interfaz es "›"). */
const RUTA = /\s*[>›/]\s*/

/** Traduce el campo `categoria` a un uuid del tipo. Sin valor → null; con valor
 *  que no cuadra → error: no se guarda sin categoría en silencio. */
export async function resolverCategoria(
  valor: string | undefined,
  tipo: 'INGRESO' | 'GASTO',
): Promise<CategoriaResuelta> {
  const buscado = (valor ?? '').trim()
  if (!buscado) return { uuid: null, nombre: null }

  const todas = await prisma.expenseCategory.findMany({
    where: { type: tipo },
    select: { uuid: true, name: true, isGroup: true, parentUuid: true },
  })

  // Sin grupos: no reciben movimientos. Se mira la marca is_group, no si tiene
  // hijas, porque un grupo recién creado está vacío.
  const nombres = new Map(todas.map((c) => [c.uuid, c.name]))
  const candidatas = todas
    .filter((c) => !c.isGroup)
    .map((c) => ({
      uuid: c.uuid,
      name: c.name,
      /** "Coche > Gasolina" para desambiguar dos "Varios" de distintos grupos. */
      ruta: c.parentUuid ? `${nombres.get(c.parentUuid) ?? ''} > ${c.name}` : c.name,
    }))

  const porUuid = candidatas.find((c) => c.uuid === buscado)
  if (porUuid) return { uuid: porUuid.uuid, nombre: porUuid.name }
  // Un uuid que existe pero es de un grupo: decirlo, no responder "no hay
  // ninguna categoría" cuando la hay y el problema es otro.
  if (todas.some((c) => c.uuid === buscado)) {
    return { error: `"${nombres.get(buscado)}" es un grupo: elige una de sus categorías` }
  }

  const clave = sinAcentos(buscado.split(RUTA).join(' > '))
  // Primero la ruta completa: si se ha escrito "Coche > Varios", eso es lo que
  // se ha pedido y no hay ambigüedad que resolver.
  const porRuta = candidatas.filter((c) => sinAcentos(c.ruta) === clave)
  if (porRuta.length === 1) return { uuid: porRuta[0].uuid, nombre: porRuta[0].name }

  const soloNombre = sinAcentos(buscado)
  const porNombre = candidatas.filter((c) => sinAcentos(c.name) === soloNombre)
  if (porNombre.length === 1) return { uuid: porNombre[0].uuid, nombre: porNombre[0].name }

  // El nombre solo es único entre hermanas ("Varios" en Coche y en Casa): con
  // ambigüedad se avisa con las rutas en vez de elegir una.
  if (porNombre.length > 1) {
    const rutas = porNombre.map((c) => `"${c.ruta}"`).join(', ')
    return { error: `Hay varias categorías llamadas "${buscado}": ${rutas}` }
  }

  return { error: `No hay ninguna categoría "${buscado}" de ese tipo` }
}
