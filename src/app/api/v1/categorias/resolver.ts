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

  const candidatas = await prisma.expenseCategory.findMany({
    where: { type: tipo },
    select: { uuid: true, name: true },
  })

  const porUuid = candidatas.find((c) => c.uuid === buscado)
  if (porUuid) return { uuid: porUuid.uuid, nombre: porUuid.name }

  const clave = sinAcentos(buscado)
  const porNombre = candidatas.filter((c) => sinAcentos(c.name) === clave)
  if (porNombre.length === 1) return { uuid: porNombre[0].uuid, nombre: porNombre[0].name }

  // El nombre es único DENTRO del tipo, así que dos coincidencias exactas no
  // pueden darse; si se dieran, callar y elegir una sería peor que avisar.
  if (porNombre.length > 1) return { error: `Hay varias categorías llamadas "${buscado}"` }

  return { error: `No hay ninguna categoría "${buscado}" de ese tipo` }
}
