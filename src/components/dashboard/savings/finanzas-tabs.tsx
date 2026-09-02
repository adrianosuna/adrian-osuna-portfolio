'use client'

// Navegación del módulo de finanzas en dos niveles: la barra de SECCIONES
// (Panel · Ahorro · Gastos · Ajustes) y, dentro de Ahorro, sus pestañas
// (Resumen + un tab por año). Las dos solo NAVEGAN: la gestión de años vive en
// la sección Ajustes.
//
// Los tabs son botones con `router.push` (no <a>), así que disparan a mano la
// barra de carga global (`useCarga`); el feedback de "cargando" lo da esa barra
// bajo la barra superior, no un spinner por pestaña.
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
