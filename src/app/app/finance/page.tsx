// Módulo de finanzas personales, en tres secciones (`?s=`):
//   · Panel  (por defecto)  — lo importante del ahorro y del mes en curso
//   · Ahorro (?s=ahorro)    — Resumen histórico + un tab por año (?year=)
//   · Gastos (?s=gastos)    — movimientos del mes (?mes=) o del año (&vista=anio)
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Euro } from 'lucide-react'
import { auth } from '@/auth'
import { getYearDetail, listYears } from '@/lib/finance'
import { getAnioMovimientos, getMesMovimientos, listCategorias } from '@/lib/gastos'
import { hoyMadrid } from '@/lib/mantenimiento'
import { AhorroTabs, FinanzasNav } from '@/components/dashboard/savings/finanzas-tabs'
import { GastosTab } from '@/components/dashboard/savings/gastos'
import { PanelFinanzas } from '@/components/dashboard/savings/panel-finanzas'
import { ContenidoPrivado } from '@/components/dashboard/savings/privado'
import { ResumenGeneral } from '@/components/dashboard/savings/resumen-general'
import { SavingsModule } from '@/components/dashboard/savings/savings-module'

export const metadata: Metadata = { title: 'Finanzas' }

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; year?: string; mes?: string; vista?: string }>
}) {
  // El layout ya redirige sin sesión, pero layout y página renderizan en
  // paralelo: la página debe protegerse por sí misma (aquí hay datos reales).
  // Las finanzas son personales del administrador: los demás roles no entran.
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/app')

  const { s, year: yearParam, mes: mesParam, vista } = await searchParams
  const hoy = hoyMadrid()
  const seccion = s === 'ahorro' ? 'ahorro' : s === 'gastos' ? 'gastos' : 'panel'

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Euro className="size-5 text-primary" />
        Finanzas
      </h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Tus finanzas personales: el sistema de ahorro anual y el control de gastos e ingresos.
      </p>

      {/* Modo privado: los importes salen ocultos y se revelan con el ojo de
          la barra (la navegación queda fuera del difuminado). */}
      <FinanzasNav seccion={seccion} />

      {seccion === 'ahorro' ? (
        <SeccionAhorro yearParam={yearParam} hoy={hoy} />
      ) : seccion === 'gastos' ? (
        <SeccionGastos mesParam={mesParam} vista={vista} hoy={hoy} />
      ) : (
        <SeccionPanel hoy={hoy} />
      )}
    </div>
  )
}

/** Panel: el ahorro del año y el mes en curso de movimientos, en una pantalla. */
async function SeccionPanel({ hoy }: { hoy: string }) {
  const categorias = await listCategorias()
  const [years, mes] = await Promise.all([listYears(), getMesMovimientos(hoy.slice(0, 7), categorias)])
  return (
    <ContenidoPrivado>
      <PanelFinanzas years={years} mes={mes} hoy={hoy} />
    </ContenidoPrivado>
  )
}

/** Ahorro: sus pestañas (Resumen histórico + años) y el módulo del año. */
async function SeccionAhorro({ yearParam, hoy }: { yearParam?: string; hoy: string }) {
  const years = await listYears()
  // Sin ?year (o con un año que no existe) se abre el Resumen histórico.
  const requested = Number(yearParam)
  const selected = years.some((y) => y.year === requested) ? requested : null
  const detail = selected === null ? null : await getYearDetail(selected)

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <AhorroTabs years={years} selected={selected} />
      </div>
      <ContenidoPrivado>
        {selected === null ? (
          <ResumenGeneral years={years} hoy={hoy} />
        ) : (
          <SavingsModule detail={detail} hoy={hoy} />
        )}
      </ContenidoPrivado>
    </>
  )
}

/** Gastos: movimientos del mes pedido (o del año, con &vista=anio). */
async function SeccionGastos({
  mesParam, vista, hoy,
}: {
  mesParam?: string
  vista?: string
  hoy: string
}) {
  const mes =
    typeof mesParam === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam)
      ? mesParam
      : hoy.slice(0, 7)
  const categorias = await listCategorias()
  // Se calculan mes y año para poder conmutar la vista sin otra consulta.
  const [movimientos, anio] = await Promise.all([
    getMesMovimientos(mes, categorias),
    getAnioMovimientos(Number(mes.slice(0, 4)), categorias),
  ])

  return (
    <ContenidoPrivado>
      <GastosTab
        datos={movimientos}
        anio={anio}
        categorias={categorias}
        mostrarAnio={vista === 'anio'}
        hoy={hoy}
      />
    </ContenidoPrivado>
  )
}
