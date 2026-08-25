// Módulo de finanzas personales: sistema de ahorro anual (réplica mejorada del
// Excel "Ahorro Anual"). El año activo va en la URL (?year=2026); sin él se
// muestra el último año disponible.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Euro } from 'lucide-react'
import { auth } from '@/auth'
import { getYearDetail, listYears } from '@/lib/finance'
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

  const requested = Number(yearParam)
  const selected = years.some((y) => y.year === requested)
    ? requested
    : (years[years.length - 1]?.year ?? null)
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
      <SavingsModule years={years} detail={detail} />
    </div>
  )
}
