// Alta de una nota, SIN autorización: la parte que comparten la server action
// del Panel y la API de los Atajos de iOS.
//
// Mismo motivo que `alta-movimiento.ts`: dos puertas de entrada al mismo dato,
// una sola definición de las reglas. Aquí la regla que más importa es que el
// HTML se SANEA en el servidor antes de guardarlo — y hacerlo en un único sitio
// es lo que garantiza que la puerta nueva no se lo salte.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { sanitizarNota, textoDe } from '@/lib/sanitizar-html'

export const NOTA_TITULO_MAX = 255
// El contenido es HTML del editor, así que el tope va más alto que el texto que
// representa (etiquetas de por medio). Cabe un apunte largo lejos del límite de
// TEXT (64 KB) y evita que un cliente manipulado llene la columna.
export const NOTA_CONTENIDO_MAX = 50_000

export type NotaParse = { error: string } | { error?: never; title: string | null; content: string }

/**
 * Título (opcional) y contenido HTML, comunes al alta y la edición. El HTML se
 * SANEA aquí (servidor) antes de guardar: es el punto donde pasa a ser de fiar,
 * así que pintarlo luego con dangerouslySetInnerHTML es seguro. La nota vacía se
 * detecta sobre el TEXTO (un editor "vacío" deja `<br>` o `<div></div>`).
 */
export const limpiarNotaHtml = (datos: { title?: string; content?: string }): NotaParse => {
  const content = sanitizarNota((datos.content ?? '').slice(0, NOTA_CONTENIDO_MAX))
  if (!textoDe(content)) return { error: 'La nota no puede estar vacía' }
  const title = (datos.title ?? '').trim().slice(0, NOTA_TITULO_MAX)
  return { title: title || null, content }
}

/**
 * Texto plano → HTML de párrafos.
 *
 * Es para la API: un Atajo dicta texto corrido, no HTML. Se escapa antes de
 * envolver (aunque el saneador pase después: escapar aquí conserva el `<` que
 * el usuario dictó en vez de dejar que el saneador se lo coma como etiqueta).
 */
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
