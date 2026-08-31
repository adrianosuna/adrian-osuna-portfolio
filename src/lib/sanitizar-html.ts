// Saneado del HTML de las notas (solo servidor). Las notas se editan en un
// editor visual (contentEditable) y se guardan como HTML; este saneador es el
// punto donde ese HTML pasa a ser de fiar, ANTES de guardarlo. Se hace en el
// servidor (no en el cliente, que se puede saltar) con `sanitize-html`, no a
// mano: escribir un saneador de HTML propio es justo lo que no se debe hacer.
//
// Sin esto, guardar HTML crudo y pintarlo con dangerouslySetInnerHTML sería el
// agujero de XSS que la auditoría del 28/08 señaló. Con la allowlist, lo que se
// guarda ya no puede traer <script>, manejadores on*, ni `javascript:` en un
// enlace. (El módulo es solo del admin, pero el saneado no depende de eso.)
import 'server-only'
import sanitizeHtml from 'sanitize-html'

const OPCIONES: sanitizeHtml.IOptions = {
  // Lo que produce el editor: formato de texto, listas, enlaces y encabezados.
  allowedTags: [
    'p', 'br', 'div', 'span',
    'b', 'strong', 'i', 'em', 'u', 's',
    'h3', 'h4',
    'ul', 'ol', 'li',
    'a', 'blockquote', 'code',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  // Solo enlaces navegables: un `javascript:`/`data:` pierde el href (queda el texto).
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    // Todo enlace abre en pestaña nueva y sin filtrar el referrer.
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }),
  },
}

/** Devuelve el HTML de una nota reducido a la allowlist segura. */
export function sanitizarNota(html: string): string {
  return sanitizeHtml(html, OPCIONES)
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
