// Capa de datos de las notas del Panel de control (solo servidor). Apuntes
// propios con formato: el contenido es HTML (editor visual), YA saneado al
// guardarse (`lib/sanitizar-html.ts`), así que pintarlo es seguro.
import 'server-only'
import { prisma } from '@/lib/prisma'

export interface NotaRow {
  uuid: string
  title: string | null
  content: string // HTML saneado
  updateTs: string // ISO
}

/** Notas, de la más reciente editada a la más antigua. */
export async function listNotes(): Promise<NotaRow[]> {
  const filas = await prisma.note.findMany({ orderBy: { updateTs: 'desc' } })
  return filas.map((n) => ({
    uuid: n.uuid,
    title: n.title,
    content: n.content,
    updateTs: n.updateTs.toISOString(),
  }))
}
