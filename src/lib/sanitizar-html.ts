// Saneado del HTML de las notas en el servidor con `sanitize-html`: es el punto
// donde el HTML pasa a ser de fiar antes de guardarse.
import 'server-only'
import sanitizeHtml from 'sanitize-html'

/** Clase que marca una lista como checklist (lista de tareas marcables). */
export const CLASE_TAREAS = 'tareas'

const OPCIONES: sanitizeHtml.IOptions = {
  // Lo que produce el editor: formato de texto, listas, enlaces y encabezados.
  allowedTags: [
    'p', 'br', 'div', 'span',
    'b', 'strong', 'i', 'em', 'u', 's',
    'h3', 'h4',
    'ul', 'ol', 'li',
    'a', 'blockquote', 'code',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    // Checklists: `class="tareas"` en la lista y `data-check` en el ítem. Solo esos
    // dos; `allowedClasses` limita la clase a ese valor.
    ul: ['class'],
    li: ['data-check'],
  },
  allowedClasses: { ul: [CLASE_TAREAS] },
  // Solo enlaces navegables: un `javascript:`/`data:` pierde el href (queda el texto).
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    // Todo enlace abre en pestaña nueva y sin filtrar el referrer.
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }),
    // `data-check` solo puede valer '0' o '1': cualquier otra cosa se normaliza
    // a '0' en vez de dejarla pasar tal cual.
    li: (nombre, attribs) => {
      const marca = attribs['data-check']
      if (marca === undefined) return { tagName: nombre, attribs }
      return {
        tagName: nombre,
        attribs: { ...attribs, 'data-check': marca === '1' ? '1' : '0' },
      }
    },
  },
}

/** Devuelve el HTML de una nota reducido a la allowlist segura. */
export function sanitizarNota(html: string): string {
  return sanitizeHtml(html, OPCIONES)
}

// Checklists: `<li data-check="0|1">` dentro de `<ul class="tareas">`. Se manipulan
// por posición, no por id: el editor no genera ids.

/** Los `data-check` de una nota, en orden de documento. */
export function tareasDe(html: string): boolean[] {
  return [...html.matchAll(/<li\b[^>]*\bdata-check="([01])"/gi)].map((m) => m[1] === '1')
}

/** Cuenta de tareas de una nota: hechas y totales (0/0 si no tiene ninguna). */
export function progresoTareas(html: string): { hechas: number; total: number } {
  const t = tareasDe(html)
  return { hechas: t.filter(Boolean).length, total: t.length }
}

/** Alterna el ítem `indice` de una checklist (null si no existe). Reescribe solo el
 *  atributo, sin volver a parsear el documento ya saneado. */
export function alternarTarea(html: string, indice: number): string | null {
  if (!Number.isInteger(indice) || indice < 0) return null
  let visto = -1
  let encontrado = false
  const nuevo = html.replace(/(<li\b[^>]*\bdata-check=")([01])(")/gi, (todo, antes, valor, despues) => {
    visto += 1
    if (visto !== indice) return todo
    encontrado = true
    return `${antes}${valor === '1' ? '0' : '1'}${despues}`
  })
  return encontrado ? nuevo : null
}

/** Texto plano del HTML (para validar que la nota no está vacía y para resúmenes).
 *  Quita etiquetas y normaliza espacios; no es saneado, solo lectura. */
export function textoDe(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}
