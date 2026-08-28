'use client'

// Navegación del módulo de finanzas en dos niveles: la barra de SECCIONES
// (Panel · Ahorro · Gastos · Ajustes) y, dentro de Ahorro, sus pestañas
// (Resumen + un tab por año). Las dos solo NAVEGAN: la gestión de años vive en
// la sección Ajustes.
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { YearSummary } from '@/lib/finance'
import { BotonPrivado } from './privado'

/** Barra de secciones del módulo (nivel 1) + el ojo del modo privado. */
export function FinanzasNav({
  seccion,
}: {
  seccion: 'panel' | 'ahorro' | 'gastos' | 'ajustes'
}) {
  const router = useRouter()
  const mesActual = new Date().toISOString().slice(0, 7)
  const secciones = [
    { id: 'panel' as const, label: 'Panel', href: '/app/finance' },
    { id: 'ahorro' as const, label: 'Ahorro', href: '/app/finance?s=ahorro' },
    { id: 'gastos' as const, label: 'Gastos', href: `/app/finance?s=gastos&mes=${mesActual}` },
    { id: 'ajustes' as const, label: 'Ajustes', href: '/app/finance?s=ajustes' },
  ]
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex max-w-full gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-card/50 p-0.5">
        {secciones.map((s) => (
          <button
            key={s.id}
            type="button"
            className={cn(
              'flex-1 shrink-0 rounded-md px-4 py-1 text-sm font-semibold transition-colors sm:flex-none',
              seccion === s.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => router.push(s.href)}>
            {s.label}
          </button>
        ))}
      </div>
      <BotonPrivado />
    </div>
  )
}

/**
 * Pestañas de la sección Ahorro (nivel 2): Resumen + un tab por año.
 *
 * Solo NAVEGAN. Crear años, cambiar su objetivo, renombrarlos, exportarlos o
 * eliminarlos es cosa de la sección Ajustes (`?s=ajustes`): aquí había un modal
 * "Gestionar años" que se retiró el 28/08/2026 al juntar toda la configuración
 * del módulo en un solo sitio.
 */
export function AhorroTabs({ years, selected }: {
  years: YearSummary[]
  /** Año activo, o null si está abierto el Resumen histórico. */
  selected: number | null
}) {
  const router = useRouter()

  const tabClass = (activo: boolean) =>
    cn(
      'shrink-0 rounded-md px-3 py-1 text-sm font-semibold transition-colors max-sm:py-2',
      activo ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
    )

  return (
    // Resumen histórico + un tab por año (scroll horizontal si no caben).
    // overflow-y-hidden: que un píxel de más nunca scrollee en vertical.
    <div className="mb-4 flex max-w-full gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-card/50 p-0.5">
      <button
        type="button"
        className={tabClass(selected === null)}
        onClick={() => router.push('/app/finance?s=ahorro')}>
        Resumen
      </button>
      {years.map((y) => (
        <button
          key={y.uuid}
          type="button"
          className={tabClass(selected === y.year)}
          onClick={() => router.push(`/app/finance?s=ahorro&year=${y.year}`)}>
          {y.year}
        </button>
      ))}
    </div>
  )
}
