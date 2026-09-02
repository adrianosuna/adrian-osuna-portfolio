'use client'

// Barra de sub-pestañas del dashboard: la píldora de fondo con los tabs dentro
// que estrenó el módulo de finanzas (secciones Panel · Ahorro · Gastos ·
// Ajustes) y ahora comparte la pestaña Usuarios del Panel de control.
//
// Vive aquí y no en `savings/finanzas-tabs.tsx` porque ya la usan dos módulos:
// las clases estaban duplicadas en cuanto el segundo la copió, y es justo cómo
// se separan dos barras que deberían verse igual.
//
// Solo NAVEGA (query param), como las de finanzas: son botones con
// `router.push` en vez de `<a>`, así que disparan a mano la barra de carga
// global (`useCarga`) — el feedback lo da esa barra, no un spinner por pestaña.
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCarga } from '@/components/dashboard/barra-carga'

/** Clases de la píldora contenedora (exportadas: las usa `finanzas-tabs`). */
export const barraTabs =
  'mb-4 flex max-w-full gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-card/50 p-0.5'

/** Clases de un tab según esté activo. */
export const claseTab = (activo: boolean) =>
  cn(
    'shrink-0 rounded-md px-4 py-1 text-sm font-semibold transition-colors max-sm:py-2.5',
    activo ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
  )

export interface SubTab {
  id: string
  label: string
  href: string
  /** Cifra al lado de la etiqueta (nº de sesiones, de accesos...). */
  cuenta?: number
}

export function SubTabs({
  tabs, activa, ariaLabel, repartir = true,
}: {
  tabs: SubTab[]
  /** `id` del tab activo. */
  activa: string
  ariaLabel: string
  /** Los tabs se reparten el ancho en móvil (con pocos y cortos, mejor). */
  repartir?: boolean
}) {
  const router = useRouter()
  const iniciar = useCarga()

  const ir = (id: string, href: string) => {
    // Sin barra de carga si ya estás en ese tab: no hay nada que cargar.
    if (id !== activa) iniciar()
    router.push(href)
  }

  return (
    <div className={barraTabs} role="group" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={cn(claseTab(activa === t.id), repartir && 'flex-1 sm:flex-none')}
          aria-current={activa === t.id ? 'page' : undefined}
          onClick={() => ir(t.id, t.href)}>
          {t.label}
          {t.cuenta !== undefined && t.cuenta > 0 && (
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                activa === t.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}>
              {t.cuenta}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
