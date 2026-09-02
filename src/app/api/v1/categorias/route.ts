// GET /api/v1/categorias — la lista, para que un Atajo la ofrezca en un menú.
//
// Devuelve nombre y uuid de cada categoría con su tipo. Con esto, el Atajo
// "apunta un gasto" puede pintar un desplegable real en vez de pedir que se
// teclee el nombre a ciegas.
import { listCategorias } from '@/lib/gastos'
import { autenticar, jsonError, jsonOk } from '../_comun'

export async function GET(req: Request) {
  const auth = await autenticar(req)
  if ('respuesta' in auth) return auth.respuesta

  const categorias = await listCategorias()
  return jsonOk({
    categorias: categorias.map((c) => ({
      uuid: c.uuid,
      nombre: c.name,
      tipo: c.type.toLowerCase(),
      tope: c.budget,
    })),
  })
}

export async function POST() {
  return jsonError('Método no permitido: usa GET', 405)
}
