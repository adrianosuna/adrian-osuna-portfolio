// GET /api/v1/resumen — lo del mes en curso, en una respuesta pequeña.
//
// Es la mitad de lectura de la API: un Atajo o un widget pregunta "¿cuánto he
// gastado este mes?" y lo lee en voz alta o lo pinta. Devuelve cifras, nunca la
// lista de movimientos: el objetivo es que quepa en una frase.
//
// Parámetro opcional `?mes=2026-08` (por defecto, el mes de hoy en Madrid).
import { getMesMovimientos, listCategorias } from '@/lib/gastos'
import { hoyMadrid } from '@/lib/mantenimiento'
import { avisosPendientes } from '@/lib/inicio'
import { autenticar, jsonError, jsonOk } from '../_comun'

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export async function GET(req: Request) {
  const auth = await autenticar(req)
  if ('respuesta' in auth) return auth.respuesta

  const pedido = new URL(req.url).searchParams.get('mes')
  if (pedido && !MES_RE.test(pedido)) {
    return jsonError('El mes debe tener la forma AAAA-MM', 400)
  }
  const mes = pedido ?? hoyMadrid().slice(0, 7)

  const categorias = await listCategorias()
  const [datos, avisos] = await Promise.all([
    getMesMovimientos(mes, categorias),
    avisosPendientes(),
  ])

  // Redondeo a dos decimales: los importes vienen ya en céntimos exactos, pero
  // la suma en coma flotante puede dejar un 0.30000000000000004 que un Atajo
  // leería tal cual en voz alta.
  const dos = (n: number) => Math.round(n * 100) / 100

  return jsonOk({
    mes,
    ingresos: dos(datos.ingresos),
    gastos: dos(datos.gastos),
    balance: dos(datos.balance),
    gastoMedioDia: dos(datos.gastoMedioDia),
    movimientos: datos.movimientos.length,
    // Diferencia con el mes anterior, que es la pregunta de verdad ("¿voy peor
    // que el mes pasado?"); null si no había nada con lo que comparar.
    frenteAlMesAnterior:
      datos.gastosPrevios > 0 ? dos(datos.gastos - datos.gastosPrevios) : null,
    // Los topes que ya han pasado del límite: lo que interesa saber sin mirar.
    topesPasados: datos.topes
      .filter((t) => t.gastado > t.budget)
      .map((t) => ({ categoria: t.name, tope: dos(t.budget), gastado: dos(t.gastado) })),
    // Los mismos avisos que la campana del dashboard, en texto plano.
    avisos: avisos.map((a) => a.texto),
  })
}

export async function POST() {
  return jsonError('Método no permitido: usa GET', 405)
}
