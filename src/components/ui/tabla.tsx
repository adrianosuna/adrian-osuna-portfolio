// La tabla del dashboard, en un solo sitio (las clases estaban copiadas en cuatro
// ficheros con tres variantes). Referencia: la del Control mensual de Ahorro.
import { cn } from '@/lib/utils'
import { panel } from '@/components/ui/superficie'

/** Celda de cabecera. Versalitas y color apagado: la fila de datos manda. */
export const thClass =
  'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground'

/** Celda de datos. */
export const tdClass = 'px-3 py-1.5'

/** Fila de totales o de resumen, al pie de la tabla. */
export const filaTotalesClase = 'bg-muted/50 font-semibold'

export interface Columna {
  /** Texto de la cabecera. */
  label: string
  /** Cabecera que se lee pero no se ve (`sr-only`), para la columna de acciones: un
   *  `<th>` vacío anuncia una columna sin nombre (axe: empty-table-header). */
  oculta?: boolean
  /** Alineación de la columna (la de los importes va a la derecha). */
  alineado?: 'izquierda' | 'derecha' | 'centro'
  /** Clases extra de la cabecera (anchos, ocultar en móvil...). */
  className?: string
}

const alineacion = {
  izquierda: 'text-left',
  derecha: 'text-right',
  centro: 'text-center',
} as const

/** Clase de alineación para una celda de datos de esa columna. */
export const alinear = (a: Columna['alineado']) => (a ? alineacion[a] : alineacion.izquierda)

/** Tabla con contenedor de scroll, cabecera y cuerpo. `minAncho` (clase Tailwind)
 *  es el ancho bajo el cual se desplaza en vez de estrujar las columnas. */
export function Tabla({
  columnas,
  minAncho,
  className,
  children,
}: {
  columnas: Columna[]
  minAncho?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    // `tabIndex`: en móvil la tabla se desplaza en horizontal, y una zona con
    // scroll tiene que poder recorrerse con el teclado (axe:
    // scrollable-region-focusable). El anillo lo pone la regla global.
    <div tabIndex={0} className={cn('overflow-x-auto', className)}>
      <table className={cn('w-full text-sm', minAncho)}>
        <thead>
          <tr className="border-b border-border">
            {columnas.map((c, i) => (
              <th
                // El índice sirve de clave: las columnas de una tabla no se
                // reordenan en caliente, y la de acciones no tiene texto.
                key={`${c.label}-${i}`}
                scope="col"
                className={cn(thClass, alinear(c.alineado), c.className)}>
                {c.oculta ? <span className="sr-only">{c.label}</span> : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** Fila del cuerpo. `destacada` marca la fila del mes en curso, la actual, etc. */
export function Fila({
  destacada,
  className,
  children,
}: {
  destacada?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <tr className={cn('border-b border-border/50', destacada && 'bg-primary/5', className)}>
      {children}
    </tr>
  )
}

/** Celda del cuerpo. */
export function Celda({
  alineado,
  className,
  colSpan,
  children,
}: {
  alineado?: Columna['alineado']
  className?: string
  colSpan?: number
  children?: React.ReactNode
}) {
  return (
    <td colSpan={colSpan} className={cn(tdClass, alinear(alineado), className)}>
      {children}
    </td>
  )
}

/** Aviso de "aquí no hay nada" como fila de la tabla: la cabecera sigue visible y
 *  enseña qué columnas tendrá cuando haya datos. */
export function FilaVacia({ columnas, children }: { columnas: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={columnas} className="px-3 py-8 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  )
}

// La misma tabla en móvil, como rejilla: un <tr> no se puede arrastrar y las filas
// con swipe lo necesitan. La plantilla de columnas debe ser la misma en cabecera y filas.

/** Cabecera de la rejilla: los nombres de las columnas. */
export function CabeceraMovil({
  columnas,
  plantilla,
}: {
  columnas: Columna[]
  plantilla: string
}) {
  return (
    <div
      // `aria-hidden`: para un lector de pantalla esto no es una tabla, así que
      // anunciar sus cabeceras sobraría — cada fila ya se lee completa.
      aria-hidden="true"
      className={cn('grid items-center gap-2 border-b border-border px-3 py-2', plantilla)}>
      {columnas.map((c, i) => (
        <span
          key={`${c.label}-${i}`}
          className={cn(
            'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
            alinear(c.alineado),
            c.className,
          )}>
          {/* Toda la cabecera va `aria-hidden`, así que una etiqueta oculta
              aquí no la leería nadie: en la rejilla el hueco se deja vacío. */}
          {c.oculta ? '' : c.label}
        </span>
      ))}
    </div>
  )
}

/** Fila de la rejilla. Misma plantilla que la cabecera. */
export function FilaMovil({
  plantilla,
  destacada,
  className,
  children,
}: {
  plantilla: string
  destacada?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'grid items-center gap-2 border-b border-border/50 px-3 py-2 last:border-0',
        plantilla,
        destacada && 'bg-primary/5',
        className,
      )}>
      {children}
    </div>
  )
}

/** Tarjeta que envuelve una tabla, con cabecera común: título con icono y cifra a
 *  la izquierda, acciones a la derecha. */
export function TarjetaTabla({
  titulo,
  icono,
  cuenta,
  acciones,
  nota,
  className,
  children,
}: {
  titulo: string
  icono?: React.ReactNode
  /** Cifra al lado del título (nº de filas, de sesiones...). */
  cuenta?: number
  /** Botones de la derecha de la cabecera. */
  acciones?: React.ReactNode
  /** Línea de apoyo bajo la cabecera (la política de sesiones, un total...). */
  nota?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn(panel, className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-5 py-3">
        {/* `h2` y no `h3`: el título de la tarjeta es el primer nivel bajo el
            `h1` de la página, y saltarse el h2 rompe el orden de encabezados. */}
        <h2 className="flex items-center gap-2 font-semibold">
          {icono}
          {titulo}
          {cuenta !== undefined && (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {cuenta}
            </span>
          )}
        </h2>
        {acciones}
      </div>
      {nota && (
        <p className="border-b border-border/60 px-5 py-2 text-[12.5px] text-muted-foreground">
          {nota}
        </p>
      )}
      {children}
    </div>
  )
}
