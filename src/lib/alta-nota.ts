// Alta de una nota sin autorización: lo que comparten la server action y la API.
// El HTML se sanea aquí, en un único sitio.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { sanitizarNota, textoDe } from '@/lib/sanitizar-html'

export const NOTA_TITULO_MAX = 255
// El contenido es HTML del editor: el tope va más alto que el texto, lejos del
// límite de TEXT (64 KB) y sin dejar llenar la columna.
export const NOTA_CONTENIDO_MAX = 50_000

export type NotaParse = { error: string } | { error?: never; title: string | null; content: string }

/** Título opcional y contenido HTML, comunes al alta y la edición. El HTML se sanea
 *  aquí antes de guardar. La nota vacía se detecta sobre el texto, no el HTML. */
export const limpiarNotaHtml = (datos: { title?: string; content?: string }): NotaParse => {
  const content = sanitizarNota((datos.content ?? '').slice(0, NOTA_CONTENIDO_MAX))
  if (!textoDe(content)) return { error: 'La nota no puede estar vacía' }
  const title = (datos.title ?? '').trim().slice(0, NOTA_TITULO_MAX)
  return { title: title || null, content }
}

/** Texto plano → HTML de párrafos, para la API. Se escapa antes de envolver para
 *  conservar un `<` dictado en vez de que el saneador lo coma como etiqueta. */
export function textoAHtml(texto: string): string {
  const escapar = (t: string) =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => `<p>${escapar(linea)}</p>`)
    .join('')
}

export type ResultadoAltaNota =
  | { error: string }
  | { error?: never; uuid: string; title: string | null }

/** Valida y crea una nota. No revalida caché ni comprueba permisos. */
export async function altaNota(datos: {
  title?: string
  content?: string
}): Promise<ResultadoAltaNota> {
  const parsed = limpiarNotaHtml(datos)
  if (parsed.error !== undefined) return { error: parsed.error }
  const fila = await prisma.note.create({
    data: { title: parsed.title, content: parsed.content },
  })
  return { uuid: fila.uuid, title: fila.title }
}
