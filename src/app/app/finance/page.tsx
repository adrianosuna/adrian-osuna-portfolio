// Módulo de finanzas personales: sistema de ahorro anual (réplica mejorada del
// Excel "Ahorro Anual") organizado en pestañas — Resumen (la foto de todos los
// años) + un tab por año. El tab activo va en la URL: sin parámetro se abre el
// Resumen; ?year=2026 abre ese año.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Euro } from 'lucide-react'
import { auth } from '@/auth'
import { getYearDetail, listYears } from '@/lib/finance'
import { hoyMadrid } from '@/lib/mantenimiento'
import { FinanzasTabs } from '@/components/dashboard/savings/finanzas-tabs'
import { ContenidoPrivado } from '@/components/dashboard/savings/privado'
import { ResumenGeneral } from '@/components/dashboard/savings/resumen-general'
import { SavingsModule } from '@/components/dashboard/savings/savings-module'

export const metadata: Metadata = { title: 'Finanzas' }

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  // El layout ya redirige sin sesión, pero layout y página renderizan en
  // paralelo: la página debe protegerse por sí misma (aquí hay datos reales).
  // Las finanzas son personales del administrador: los demás roles no entran.
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/app')

  const { year: yearParam } = await searchParams
  const years = await listYears()

  // Sin ?year (o con un año que no existe) se abre la pestaña Resumen.
  const requested = Number(yearParam)
  const selected = years.some((y) => y.year === requested) ? requested : null
  const detail = selected === null ? null : await getYearDetail(selected)

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Euro className="size-5 text-primary" />
        Finanzas
      </h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Tus finanzas personales: sistema de ahorro anual y, próximamente, control de gastos.
      </p>
      {/* Modo privado: los importes salen ocultos y se revelan con el ojo de
          la barra (la barra queda fuera del difuminado para poder navegar). */}
      <FinanzasTabs years={years} selected={selected} />
      <ContenidoPrivado>
        {selected === null ? (
          <ResumenGeneral years={years} hoy={hoyMadrid()} />
        ) : (
          <SavingsModule detail={detail} hoy={hoyMadrid()} />
        )}
      </ContenidoPrivado>
    </div>
  )
}
