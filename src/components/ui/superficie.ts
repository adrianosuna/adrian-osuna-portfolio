// Superficies del sitio, en un solo sitio: las comparten la landing y el
// dashboard. La clase CSS (`globals.css`) trae fondo, borde y brillo; aquí se
// le añade el radio y, si toca, el hover.

/** Tarjeta de contenido. Radio grande: es el contenedor de primer nivel. */
export const tarjeta = 'superficie rounded-2xl'

/** Tarjeta que además es enlace o botón (aclara el borde al pasar el ratón). */
export const tarjetaInt = 'superficie superficie-int rounded-2xl'

/** Tarjeta con contenido a sangre (tablas, listas): recorta lo de dentro. */
export const panel = 'superficie overflow-hidden rounded-2xl'

/** Baldosa hundida dentro de una tarjeta (datos sueltos, campos agrupados). */
export const baldosa = 'superficie-baja rounded-xl'

/** Separador entre filas de una lista o tabla. */
export const filo = 'border-white/8'
