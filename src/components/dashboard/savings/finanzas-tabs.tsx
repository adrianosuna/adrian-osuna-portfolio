'use client'

// Navegación de Finanzas en dos niveles: secciones y, en Ahorro, pestañas por año.
// Solo navegan; son botones con `router.push` y disparan la barra de carga (`useCarga`).
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { YearSummary } from '@/lib/finance'
import { useCarga } from '@/components/dashboard/barra-carga'
// Las clases viven en `dashboard/sub-tabs.tsx`: esta misma barra la usa ya la
// pestaña Usuarios del Panel, y duplicarlas es cómo dejan de verse igual.
import { barraTabs as barra, claseTab as tabClass } from '@/components/dashboard/sub-tabs'

/** Barra de secciones del módulo (nivel 1). */
export function FinanzasNav({
  seccion,
}: {
  seccion: 'panel' | 'ahorro' | 'gastos' | 'ajustes'
}) {
  const router = useRouter()
  const iniciar = useCarga()
  const mesActual = new Date().toISOString().slice(0, 7)
  const secciones = [
    { id: 'panel' as const, label: 'Panel', href: '/app/finance' },
    { id: 'ahorro' as const, label: 'Ahorro', href: '/app/finance?s=ahorro' },
    { id: 'gastos' as const, label: 'Gastos', href: `/app/finance?s=gastos&mes=${mesActual}` },
    { id: 'ajustes' as const, label: 'Ajustes', href: '/app/finance?s=ajustes' },
  ]
  const ir = (id: string, href: string) => {
    if (id !== seccion) iniciar()
    router.push(href)
  }
  return (
    <div className={barra}>
      {secciones.map((s) => (
        <button
          key={s.id}
          type="button"
          className={cn(tabClass(seccion === s.id), 'flex-1 sm:flex-none')}
          onClick={() => ir(s.id, s.href)}>
          {s.label}
        </button>
      ))}
    </div>
  )
}

/** Pestañas de la sección Ahorro: Resumen y un tab por año. Solo navegan; la
 *  gestión de años vive en Ajustes. */
export function AhorroTabs({ years, selected }: {
  years: YearSummary[]
  /** Año activo, o null si está abierto el Resumen histórico. */
  selected: number | null
}) {
  const router = useRouter()
  const iniciar = useCarga()
  const actual = selected === null ? 'resumen' : String(selected)
  const ir = (id: string, href: string) => {
    if (id !== actual) iniciar()
    router.push(href)
  }

  return (
    // Resumen histórico + un tab por año (scroll horizontal si no caben).
    // overflow-y-hidden: que un píxel de más nunca scrollee en vertical.
    <div className={barra}>
      <button type="button" className={tabClass(selected === null)} onClick={() => ir('resumen', '/app/finance?s=ahorro')}>
        Resumen
      </button>
      {years.map((y) => (
        <button
          key={y.uuid}
          type="button"
          className={tabClass(selected === y.year)}
          onClick={() => ir(String(y.year), `/app/finance?s=ahorro&year=${y.year}`)}>
          {y.year}
        </button>
      ))}
    </div>
  )
}
