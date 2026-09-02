// La tabla del dashboard, en UN solo sitio.
//
// Antes las clases de `th` y `td` estaban copiadas en cuatro ficheros con TRES
// variantes distintas (`py-1.5`, `py-2`, `py-2.5` y una responsive), y algunas
// listas que son tabulares —sesiones, accesos, tokens— se pintaban como `div`
// apilados: parecidas de lejos, distintas de cerca. Se ve en cuanto se abren
// dos pestañas seguidas.
//
// La referencia es la tabla del **Control mensual** de Ahorro, que es la que
// está bien estructurada: cabecera en versalitas sobre fondo de tarjeta,
// separador por fila, celdas compactas y el contenedor con scroll horizontal
// propio para que en móvil la tabla se desplace sin arrastrar la página.
//
// Lo que NO decide este módulo: qué va en cada fila. Solo la estructura y el
// aspecto, que es lo que tiene que ser igual en todas.
import { cn } from '@/lib/utils'

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
  /**
   * La cabecera se lee pero no se ve (`sr-only`).
   *
   * Es para la columna de acciones: dejar el `<th>` VACÍO es un fallo de
   * accesibilidad —lo caza `empty-table-header` de axe— porque el lector de
   * pantalla anuncia una columna sin nombre. Con esto la columna se llama
   * "Acciones" para quien la escucha y sigue sin título para quien la ve.
   */
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

/**
 * Tabla con su contenedor de scroll, su cabecera y su cuerpo.
 *
 * `minAncho` es la anchura por debajo de la cual la tabla se desplaza en vez de
 * apretarse: sin ella, en móvil las columnas se estrujan hasta partir cada
 * palabra en dos líneas. Se pasa como clase de Tailwind (`min-w-140`) porque el
 * valor depende de cuántas columnas tenga cada tabla.
 */
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
    <div className={cn('overflow-x-auto', className)}>
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

/**
 * Aviso de "aquí no hay nada", dentro de la propia tabla.
 *
 * Va como fila y no como párrafo al lado para que la cabecera siga visible: así
 * se ve QUÉ columnas tendría la tabla cuando tenga datos, en vez de un hueco
 * suelto que no dice nada.
 */
export function FilaVacia({ columnas, children }: { columnas: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={columnas} className="px-3 py-8 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  )
}

// ─────────── La misma tabla, en móvil ───────────
//
// Por qué hace falta esto y no basta la tabla de arriba: hay listas donde la
// fila lleva un **gesto de swipe** (los movimientos del mes), y un `<tr>` no
// se puede arrastrar con el dedo — el gesto necesita envolver cada fila en su
// propio contenedor con `transform`, que dentro de un `<table>` no cabe.
//
// La solución es una REJILLA con la misma gramática visual: cabecera en
// versalitas apagadas, separador por fila, mismos paddings y los importes
// alineados en su columna. Cada fila es su propia rejilla con la MISMA
// plantilla de columnas, y por eso quedan alineadas entre sí aunque no
// compartan un `<table>`.
//
// ⚠ La plantilla se pasa entera (`grid-cols-[...]`) y tiene que ser la misma
// en la cabecera y en las filas: son dos llamadas distintas, así que si se
// cambia una hay que cambiar la otra. Se declara una vez como constante en el
// componente que las use.

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

/**
 * Tarjeta que envuelve una tabla, con su cabecera.
 *
 * La cabecera es la misma en todas: título a la izquierda —con su icono y, si
 * viene, la cifra en una píldora— y las acciones a la derecha.
 */
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
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}>
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
