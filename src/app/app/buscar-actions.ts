'use server'

// Búsqueda GLOBAL del dashboard: la que alimenta la paleta ⌘K.
//
// Cruza los tres sitios donde hay texto que uno recuerda —movimientos,
// oportunidades y notas— y devuelve pocos resultados de cada uno. No pretende
// ser el buscador de ningún módulo (Gastos tiene el suyo, con filtros de fecha
// e importe): esto es para "sé que apunté algo de la caldera y no sé dónde".
//
// Vive fuera de los módulos a propósito: no es de finanzas ni del pipeline. Los
// TIPOS y las constantes están en `lib/buscar.ts`, porque un módulo
// `'use server'` solo puede exportar funciones async.
import { requireAdmin } from '@/auth'
import { prisma } from '@/lib/prisma'
import { textoDe } from '@/lib/sanitizar-html'
import {
  MINIMO_BUSQUEDA, POR_GRUPO, RESULTADO_VACIO, type ResultadoGlobal,
} from '@/lib/buscar'

/**
 * Busca `q` en movimientos (concepto y nota), oportunidades (título, empresa,
 * contacto y notas) y notas (título y contenido).
 *
 * Sin sesión de admin devuelve vacío en vez de lanzar: la paleta no debe
 * romperse por esto, y quien no es admin no tiene ninguno de estos módulos.
 */
export async function buscarGlobal(q: string): Promise<ResultadoGlobal> {
  const texto = (q ?? '').trim().slice(0, 100)
  if (texto.length < MINIMO_BUSQUEDA) return RESULTADO_VACIO
  try {
    await requireAdmin()
  } catch {
    return RESULTADO_VACIO
  }

  const contiene = { contains: texto }
  const [movimientos, oportunidades, notas] = await Promise.all([
    prisma.expense.findMany({
      where: { OR: [{ concept: contiene }, { note: contiene }] },
      orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
      take: POR_GRUPO,
    }),
    prisma.opportunity.findMany({
      where: {
        OR: [
          { title: contiene }, { company: contiene }, { contact: contiene }, { notes: contiene },
        ],
      },
      orderBy: { updateTs: 'desc' },
      take: POR_GRUPO,
    }),
    // El contenido es HTML: se busca en él (la etiqueta no molesta para un
    // `contains`) y el TÍTULO que se muestra sale del texto plano.
    prisma.note.findMany({
      where: { OR: [{ title: contiene }, { content: contiene }] },
      orderBy: { updateTs: 'desc' },
      take: POR_GRUPO,
    }),
  ])

  return {
    movimientos: movimientos.map((m) => ({
      uuid: m.uuid,
      concepto: m.concept,
      importe: Number(m.amount),
      fecha: m.expenseDate.toISOString().slice(0, 10),
      esGasto: m.type === 'GASTO',
    })),
    oportunidades: oportunidades.map((o) => ({
      uuid: o.uuid,
      titulo: o.title,
      empresa: o.company,
      estado: o.status,
    })),
    notas: notas.map((n) => ({
      uuid: n.uuid,
      titulo: n.title || textoDe(n.content).slice(0, 60) || 'Sin título',
    })),
  }
}
