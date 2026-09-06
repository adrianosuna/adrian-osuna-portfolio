// GET /api/v1/categorias — la lista, para que un Atajo la ofrezca en un menú.
//
// Devuelve nombre y uuid de cada categoría con su tipo. Con esto, el Atajo
// "apunta un gasto" puede pintar un desplegable real en vez de pedir que se
// teclee el nombre a ciegas.
//
// Sin los GRUPOS: un grupo ("Coche") no recibe movimientos, así que ofrecerlo
// en el menú del Atajo sería ofrecer una opción que el alta va a rechazar. Su
// `nombre` viene con la ruta completa ("Coche > Gasolina") porque es lo único
// que distingue dos "Varios" de grupos distintos — y es exactamente lo que el
// alta acepta de vuelta en `categoria`.
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
