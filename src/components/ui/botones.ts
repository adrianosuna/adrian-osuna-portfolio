// Escala de botones del dashboard, en un solo sitio (estaba copiada en cinco).
// `max-sm:py-2.5` sube los botones a ~40 px en móvil, el criterio para el pulgar.

/** Botón de acción principal (esmeralda, texto oscuro por contraste AA). */
export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 max-sm:py-2.5'

/** Botón secundario (contorno). */
export const btnOutline =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 max-sm:py-2.5'

/** Botón de solo icono: se queda en 34-36 px porque es una acción de fila, y subirlo
 *  estiraría las listas largas. `disabled:hover:*` evita reaccionar apagado. */
export const btnIcon =
  'rounded-md p-2 max-sm:p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground'

/** Chip de un grupo de filtros o de un conmutador de vista. Misma subida a 40 px
 *  en móvil que los botones. */
export const chipFiltro =
  'whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition-colors max-sm:flex-1 max-sm:py-2.5'
