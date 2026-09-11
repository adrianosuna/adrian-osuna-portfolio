'use server'

// Búsqueda global de la paleta ⌘K: pocos resultados de movimientos, oportunidades
// y notas. Tipos y constantes en `lib/buscar.ts` ('use server' solo exporta async).
import { requireAdmin } from '@/auth'
import { prisma } from '@/lib/prisma'
import { textoDe } from '@/lib/sanitizar-html'
import {
  MINIMO_BUSQUEDA, POR_GRUPO, RESULTADO_VACIO, type ResultadoGlobal,
} from '@/lib/buscar'

/** Busca `q` en movimientos, oportunidades y notas. Sin sesión de admin devuelve
 *  vacío en vez de lanzar: la paleta no debe romperse por esto. */
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
