// GET /api/v1/categorias: nombre y uuid por tipo para el menú de un Atajo. Sin
// grupos (no reciben movimientos); el nombre lleva la ruta ("Coche > Gasolina").
import { listCategorias } from '@/lib/gastos'
import { esGrupo, etiquetaCategoria } from '@/lib/categorias'
import { autenticar, jsonError, jsonOk } from '../_comun'

export async function GET(req: Request) {
  const auth = await autenticar(req)
  if ('respuesta' in auth) return auth.respuesta

  const categorias = await listCategorias()
  return jsonOk({
    categorias: categorias
      .filter((c) => !esGrupo(c))
      .map((c) => ({
        uuid: c.uuid,
        nombre: etiquetaCategoria(c).replace(' › ', ' > '),
        tipo: c.type.toLowerCase(),
        grupo: c.parentName,
        tope: c.budget,
      })),
  })
}

export async function POST() {
  return jsonError('Método no permitido: usa GET', 405)
}
