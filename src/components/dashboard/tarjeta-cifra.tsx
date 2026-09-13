// La tarjeta de cifra del dashboard, en un solo sitio: estaba copiada en cinco
// (inicio, panel de finanzas, gastos, resumen de años y búsqueda) con tres
// tamaños de cifra y el icono unas veces en verde y otras apagado.
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { tarjeta, tarjetaInt } from '@/components/ui/superficie'

export interface TarjetaCifraProps {
  label: string
  valor: React.ReactNode
  /** Línea de contexto bajo la cifra (una comparativa, un recuento). */
  pie?: React.ReactNode
  /** Icono a la derecha de la etiqueta. Va apagado: el color lo lleva el dato. */
  icono?: React.ReactNode
  /** Color de la cifra, solo cuando el signo ES la información (un balance). */
  tono?: 'success' | 'danger' | 'primary'
  /** Si la tarjeta lleva a algún sitio, se comporta como enlace. */
  to?: string
  className?: string
}

export function TarjetaCifra({ label, valor, pie, icono, tono, to, className }: TarjetaCifraProps) {
  const cuerpo = (
    <div className={cn('@container', to ? tarjetaInt : tarjeta, 'h-full p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] text-muted-foreground">{label}</p>
        {icono && (
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/6 text-muted-foreground">
            {icono}
          </span>
        )}
      </div>
      {/* En una tarjeta ancha (el dashboard a todo el ancho) el pie se pone al lado
          de la cifra en vez de debajo: es la anchura de LA TARJETA la que decide, no
          la de la ventana, así que se mide con una consulta de contenedor. */}
      <div className="mt-2 flex flex-col gap-2.5 @sm:flex-row @sm:items-end @sm:justify-between @sm:gap-4">
        <p
          className={cn(
            'text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-3xl',
            tono === 'success' && 'text-success',
            tono === 'danger' && 'text-danger',
            tono === 'primary' && 'text-primary',
          )}>
          {valor}
        </p>
        {pie && (
          <div className="min-w-0 text-[12px] leading-snug text-muted-foreground @sm:flex-1 @sm:text-right">
            {pie}
          </div>
        )}
      </div>
    </div>
  )
  return to ? <Link href={to}>{cuerpo}</Link> : cuerpo
}

/** Hueco de una tarjeta de cifra mientras carga. */
export function TarjetaCifraEsqueleto() {
  return (
    <div className={cn(tarjeta, 'h-full p-4 sm:p-5')} aria-hidden="true">
      <div className="h-3.5 w-24 animate-pulse rounded bg-white/8" />
      <div className="mt-3 h-7 w-16 animate-pulse rounded bg-white/8" />
      <div className="mt-3 h-3 w-28 animate-pulse rounded bg-white/8" />
    </div>
  )
}
