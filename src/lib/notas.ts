// Capa de datos de las notas del Panel de control (solo servidor). Apuntes
// propios con formato: el contenido es HTML (editor visual), YA saneado al
// guardarse (`lib/sanitizar-html.ts`), así que pintarlo es seguro.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { progresoTareas, textoDe } from '@/lib/sanitizar-html'

export interface NotaRow {
  uuid: string
  title: string | null
  content: string // HTML saneado
  /** Fijada arriba. */
  pinned: boolean
  /** Texto plano del contenido: lo que busca el buscador (el HTML no se busca:
   *  "strong" no es una palabra de la nota). Se calcula aquí, en el servidor,
   *  para no repetirlo en cada tecla del filtro. */
  texto: string
  /** Progreso de su checklist, si tiene ({0,0} si no). */
  tareas: { hechas: number; total: number }
  updateTs: string // ISO
}

/** Notas: las fijadas primero y, dentro de cada grupo, la más reciente antes. */
export async function listNotes(): Promise<NotaRow[]> {
  const filas = await prisma.note.findMany({
    orderBy: [{ pinned: 'desc' }, { updateTs: 'desc' }],
  })
  return filas.map((n) => ({
    uuid: n.uuid,
    title: n.title,
    content: n.content,
    pinned: n.pinned,
    texto: textoDe(n.content),
    tareas: progresoTareas(n.content),
    updateTs: n.updateTs.toISOString(),
  }))
}
