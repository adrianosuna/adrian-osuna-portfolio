// Resolver una categoría desde la API: acepta el uuid o el NOMBRE.
//
// Por qué existe: en un Atajo del iPhone el campo de la categoría lo rellena
// una persona hablando o eligiendo de una lista de texto, no pegando un uuid.
// Así el Atajo puede decir "Compra" y funciona; el uuid sigue valiendo para
// quien lo tenga (la respuesta de `/api/v1/categorias` lo trae).
//
// El nombre se compara sin tildes ni mayúsculas, igual que el buscador de
// Ajustes: "cafe" encuentra "Café".
import 'server-only'
import { prisma } from '@/lib/prisma'
import { sinAcentos } from '@/lib/utils'

export type CategoriaResuelta = { error: string } | { uuid: string | null; nombre: string | null }

/** Separadores admitidos para una ruta "Coche > Gasolina" (el Atajo puede
 *  mandar cualquiera de los tres, y el de la interfaz es "›"). */
const RUTA = /\s*[>›/]\s*/

/**
 * Traduce lo que llegue en el campo `categoria` a un uuid válido de ese tipo.
 *
 * Sin valor → `{ uuid: null }` (movimiento sin categoría, que es legítimo).
 * Con valor que no cuadra → error: guardarlo sin categoría en silencio es
 * justo el fallo que no se ve hasta que el desglose del mes sale raro.
 */
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

  // Sin los GRUPOS: un grupo ("Coche") no recibe movimientos, así que
  // aceptarlo aquí crearía por la API justo el dato que la interfaz no deja
  // crear. Se mira la MARCA y no "si tiene hijas", porque un grupo recién
  // creado está vacío y pasaría por categoría.
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

  // Con grupos, el nombre solo es único entre hermanas: "Varios" puede estar
  // en Coche y en Casa. Callar y elegir una sería peor que avisar, y el
  // mensaje trae las rutas para que el Atajo se corrija de una.
  if (porNombre.length > 1) {
    const rutas = porNombre.map((c) => `"${c.ruta}"`).join(', ')
    return { error: `Hay varias categorías llamadas "${buscado}": ${rutas}` }
  }

  return { error: `No hay ninguna categoría "${buscado}" de ese tipo` }
}
