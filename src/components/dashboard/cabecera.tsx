// Cabecera de una página del dashboard: título con icono y una línea de apoyo.
// Misma escala tipográfica que las cabeceras de sección de la landing.
import { cn } from '@/lib/utils'

export function CabeceraPagina({
  titulo, descripcion, icono, iconoDescripcion, acciones, className,
}: {
  titulo: string
  /** Línea de apoyo bajo el título. */
  descripcion?: string
  icono?: React.ReactNode
  /** Icono al principio de la línea de apoyo (la fecha del inicio). */
  iconoDescripcion?: React.ReactNode
  /** Botones a la derecha del título. */
  acciones?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.02em]">
          {icono && <span className="text-muted-foreground">{icono}</span>}
          {titulo}
        </h1>
        {descripcion && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            {iconoDescripcion}
            {descripcion}
          </p>
        )}
      </div>
      {acciones}
    </div>
  )
}
