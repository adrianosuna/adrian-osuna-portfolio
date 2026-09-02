// Escala de botones del dashboard, en UN solo sitio.
//
// Estaba copiada en CINCO ficheros (savings/comun, pipeline/comun,
// panel/mantenimiento, panel/notas y users/users-table) con las mismas clases
// palabra por palabra —y con pequeñas divergencias en los estados `disabled:`,
// que es justo cómo empiezan a separarse—. Unificarla fue lo que hizo falta al
// subir la altura táctil: había que tocar los cinco a la vez.
//
// ALTURA EN MÓVIL: `max-sm:py-2.5` sube los botones de ~34 px a ~40, que es el
// criterio del proyecto para el pulgar. WCAG 2.2 AA pide 24 px como mínimo, así
// que 34 pasaba; 40 es cómodo de verdad, y es lo que ya medían las piezas
// nuevas (paleta, diálogo de confirmación, sub-pestañas).

/** Botón de acción principal (esmeralda, texto oscuro por contraste AA). */
export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 max-sm:py-2.5'

/** Botón secundario (contorno). */
export const btnOutline =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 max-sm:py-2.5'

/**
 * Botón de solo icono. Se queda en p-2 / p-2.5 (34-36 px): no es un botón de
 * formulario sino una acción de fila, y subirlo a 40 estiraría cada fila de las
 * listas largas (movimientos, sesiones) sin ganar nada — el objetivo ya está
 * holgadamente por encima del mínimo AA.
 *
 * Los `disabled:hover:*` evitan que un botón inhabilitado reaccione al pasar por
 * encima (venía solo en la copia de users-table; es lo correcto en todas).
 */
export const btnIcon =
  'rounded-md p-2 max-sm:p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground'

/**
 * Chip de un grupo de filtros o de un conmutador de vista (Mes/Año,
 * Lista/Calendario, filtros por ámbito o por tipo). Misma subida a 40 px en
 * móvil que los botones.
 */
export const chipFiltro =
  'whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition-colors max-sm:flex-1 max-sm:py-2.5'
