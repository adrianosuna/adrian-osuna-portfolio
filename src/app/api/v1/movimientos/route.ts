// POST /api/v1/movimientos: apunta un gasto o ingreso desde un Atajo. Solo concepto
// e importe son obligatorios; tipo cae a "gasto" y fecha a hoy (Madrid).
import { revalidatePath } from 'next/cache'
import { altaMovimiento } from '@/lib/alta-movimiento'
import { hoyMadrid } from '@/lib/mantenimiento'
import { log } from '@/lib/log'
import { aNumero, aTexto, autenticar, jsonError, jsonOk, leerJson } from '../_comun'
import { resolverCategoria } from '../categorias/resolver'

export async function POST(req: Request) {
  const auth = await autenticar(req)
  if ('respuesta' in auth) return auth.respuesta

  const cuerpo = await leerJson(req)
  if ('respuesta' in cuerpo) return cuerpo.respuesta
  const d = cuerpo.datos

  const importe = aNumero(d.importe ?? d.amount)
  if (importe === null) return jsonError('Falta el importe (o no es un número)', 400)

  // Se aceptan las claves en español (para los Atajos) y en inglés (para quien
  // venga de la interfaz): mismo endpoint, dos vocabularios.
  const tipoCrudo = (aTexto(d.tipo ?? d.type) ?? 'gasto').toUpperCase()
  const tipo = tipoCrudo === 'INGRESO' ? 'INGRESO' : tipoCrudo === 'GASTO' ? 'GASTO' : null
  if (!tipo) return jsonError('El tipo debe ser "gasto" o "ingreso"', 400)

  // La categoría se admite POR NOMBRE además de por uuid: teclear un uuid en
  // un Atajo del iPhone no es una opción realista.
  const cat = await resolverCategoria(aTexto(d.categoria ?? d.categoryUuid), tipo)
  if ('error' in cat) return jsonError(cat.error, 400)

  const res = await altaMovimiento({
    type: tipo,
    concept: aTexto(d.concepto ?? d.concept),
    amount: importe,
    expenseDate: aTexto(d.fecha ?? d.expenseDate) ?? hoyMadrid(),
    categoryUuid: cat.uuid,
    note: aTexto(d.nota ?? d.note) ?? null,
  })
  if (res.error !== undefined) return jsonError(res.error, 400)

  // Que el dashboard lo vea sin recargar a mano.
  revalidatePath('/app/finance')
  revalidatePath('/app')
  log.info('api', 'movimiento apuntado', { uuid: res.uuid, tipo, importe: res.amount })

  return jsonOk(
    {
      movimiento: {
        uuid: res.uuid,
        concepto: res.concept,
        importe: res.amount,
        fecha: res.expenseDate,
        tipo: tipo.toLowerCase(),
        categoria: cat.nombre,
      },
      // Frase lista para que el Atajo la lea en voz alta.
      mensaje: `${tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} de ${res.amount} € apuntado: ${res.concept}`,
    },
    201,
  )
}

/** Cualquier otro método: 405 con la lista de los admitidos. */
export async function GET() {
  return jsonError('Método no permitido: usa POST', 405)
}
