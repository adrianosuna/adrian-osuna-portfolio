// Clases compartidas por las secciones de la landing (servidor) y sus islas
// cliente. Sin directiva: lo importan los dos lados.
import { cn } from '@/lib/utils'

export const contenedor = 'mx-auto w-full max-w-6xl px-6 sm:px-8'
export const seccion = cn(contenedor, 'py-20 sm:py-24')

export const tarjeta = 'pf-card relative overflow-hidden rounded-2xl'
export const btnPrimario =
  'inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-primary'
export const btnSecundario =
  'inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/3 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-white/25 hover:bg-white/6'
export const chip = 'rounded-md border border-white/8 bg-white/4 px-2 py-0.5 text-xs text-body'
export const etiqueta = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'
export const enlace =
  'inline-flex items-center gap-1 text-sm font-medium text-foreground transition-colors hover:text-primary'
