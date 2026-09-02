// Inicio del dashboard: centro de mando. Primero lo que requiere atención hoy
// (seguimientos vencidos, mantenimiento, meses de ahorro sin rellenar), luego
// los KPIs con dato real y la actividad reciente. Los datos llegan de una sola
// pasada paralela (lib/inicio.ts); el pulso de visitas va en Suspense para que
// la red externa no retrase el pintado. Las piezas visuales, en components/.
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Briefcase, CalendarDays, Euro, ExternalLink, Receipt, TrendingDown, TrendingUp,
} from 'lucide-react'
import { auth } from '@/auth'
import { resumenInicio } from '@/lib/inicio'
import { pulsoVisitas } from '@/lib/ga'
import { Actividad, Atencion, Tile, TileEsqueleto, cardClass } from '@/components/dashboard/inicio'
// Mismo formateador que el módulo de finanzas (fuente única): los KPIs de
// ahorro y gastos de aquí son las mismas cifras que se ven allí.
import { eur } from '@/lib/euros'
import { AccesosFijados } from '@/components/dashboard/accesos-fijados'
import { AbrirAltaAlEntrar } from '@/components/dashboard/abrir-al-entrar'
import { cn } from '@/lib/utils'

/**
 * Comparativa del gasto del mes frente al anterior (en gastos, subir es malo →
 * rojo). Sin dato del mes pasado, cae al texto neutro de la tarjeta.
 */
function GastoMoM({ actual, previo }: { actual: number; previo: number }) {
  if (previo <= 0) return <>{actual === 0 ? 'nada registrado todavía' : 'control de gastos'}</>
  const delta = Math.round(((actual - previo) / previo) * 100)
  if (delta === 0) return <>igual que el mes pasado</>
  const sube = delta > 0
  return (
    <span className={cn('inline-flex items-center gap-1', sube ? 'text-danger' : 'text-success')}>
      {sube ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {sube ? '+' : ''}{delta}&nbsp;% frente al mes pasado
    </span>
  )
}

// Saludo según la hora del día (hora española).
const saludo = () => {
  const h = Number(new Date().toLocaleString('es-ES', { hour: 'numeric', hour12: false, timeZone: 'Europe/Madrid' }))
  if (h < 7) return 'Buenas noches'
  if (h < 14) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

/** Pulso de visitas (GA4). En Suspense: si Google tarda, el resto ya está. */
async function TileVisitas() {
  const pulso = await pulsoVisitas()
  if (!pulso) return null
  const { usuarios, previos } = pulso
  const delta = previos > 0 ? Math.round(((usuarios - previos) / previos) * 100) : null
  const sube = delta !== null && delta >= 0
  return (
    <Tile
      label="Visitas (7 días)"
      valor={usuarios.toLocaleString('es-ES', { useGrouping: 'always' })}
      icon={<TrendingUp className="size-4" />}
      chip="bg-primary/10 text-primary"
      to="/app/panel?tab=visitas"
      pie={
        delta === null ? (
          'Sin comparativa'
        ) : (
          <span className={cn('inline-flex items-center gap-1', sube ? 'text-success' : 'text-danger')}>
            {sube ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {sube ? '+' : ''}{delta}&nbsp;% frente a los 7 previos
          </span>
        )
      }
    />
  )
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ nuevo?: string }>
}) {
  // `?nuevo=gasto` viene del acceso directo del icono (shortcut del manifest):
  // abre el alta rápida al entrar, sin pasar por Finanzas.
  const { nuevo } = await searchParams
  const altaAlEntrar = nuevo === 'ingreso' ? 'INGRESO' : nuevo === 'gasto' ? 'GASTO' : null
  // El layout ya redirige sin sesión, pero layout y página renderizan en
  // paralelo: la página debe protegerse por sí misma.
  const session = await auth()
  if (!session?.user) redirect('/login')
  const user = session.user
  const isAdmin = user.role === 'ADMIN'
  const firstName = (user.name ?? '').split(' ')[0] || 'de nuevo'
  const fechaRaw = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid',
  })
  const hoy = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1)

  // Los módulos son personales del administrador: a otros roles ni se consultan.
  const resumen = isAdmin ? await resumenInicio() : null

  const cabecera = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">
          {saludo()}, {firstName}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          {hoy}
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-semibold transition-colors hover:border-primary hover:text-primary">
        <ExternalLink className="size-3.5" /> Ver el portfolio
      </Link>
    </div>
  )

  // Usuarios invitados: el dashboard no tiene módulos para ellos.
  if (!isAdmin || !resumen) {
    return (
      <div>
        {cabecera}
        <div className={cn(cardClass, 'mt-6 p-6 text-center')}>
          <p className="text-sm font-semibold">Tu cuenta está activa</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
            Los módulos de gestión (finanzas, oportunidades y panel de control) son personales
            del administrador. Desde aquí puedes visitar el portfolio público.
          </p>
        </div>
      </div>
    )
  }

  const { avisos, ahorro, gastadoMes, gastadoMesPrevio, pipeline, actividad } = resumen
  const pctObjetivo = ahorro && ahorro.goal ? Math.round((ahorro.total / ahorro.goal) * 100) : null

  return (
    <div>
      {/* Acceso directo del icono de la app: abre el alta al entrar. */}
      {altaAlEntrar && <AbrirAltaAlEntrar tipo={altaAlEntrar} />}
      {cabecera}

      {/* Lo primero: qué requiere atención hoy */}
      <h2 className="mb-2.5 mt-6 text-[13px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
        {avisos.length ? 'Requiere tu atención' : 'Estado'}
      </h2>
      <Atencion avisos={avisos} />

      {/* KPIs con dato real */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={ahorro ? `Ahorro en ${ahorro.year}` : 'Ahorro'}
          valor={ahorro ? eur(ahorro.total) : '—'}
          icon={<Euro className="size-4" />}
          chip="bg-primary/10 text-primary"
          to={ahorro ? `/app/finance?s=ahorro&year=${ahorro.year}` : '/app/finance?s=ahorro'}
          pie={
            !ahorro ? (
              'Sin año creado'
            ) : pctObjetivo === null ? (
              'Sin objetivo fijado'
            ) : (
              <span className="flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn('block h-full rounded-full', pctObjetivo >= 100 ? 'bg-success' : 'bg-primary')}
                    style={{ width: `${Math.min(100, pctObjetivo)}%` }}
                  />
                </span>
                <span className="shrink-0 tabular-nums">{pctObjetivo}&nbsp;% del objetivo</span>
              </span>
            )
          }
        />
        <Tile
          label="Gastos del mes"
          valor={eur(gastadoMes)}
          icon={<Receipt className="size-4" />}
          chip="bg-success-bg text-success"
          to={`/app/finance?s=gastos&mes=${new Date().toISOString().slice(0, 7)}`}
          pie={<GastoMoM actual={gastadoMes} previo={gastadoMesPrevio} />}
        />
        <Tile
          label="Pipeline abierto"
          valor={eur(pipeline.valorAbierto)}
          icon={<Briefcase className="size-4" />}
          chip="bg-warning-bg text-warning"
          to="/app/pipeline"
          pie={
            pipeline.abiertas === 0
              ? 'Ninguna oportunidad viva'
              : `${pipeline.abiertas} ${pipeline.abiertas === 1 ? 'oportunidad' : 'oportunidades'} en juego`
          }
        />
        <Suspense fallback={<TileEsqueleto />}>
          <TileVisitas />
        </Suspense>
      </div>

      {/* Actividad reciente + accesos a los módulos */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[7fr_5fr]">
        <Actividad items={actividad} />

        {/* Accesos ELEGIDOS: el catálogo está completo y cada uno fija los que
            usa (antes eran los tres módulos fijos, que es el mapa del menú, no
            lo que se abre a diario). */}
        <AccesosFijados mes={new Date().toISOString().slice(0, 7)} cardClass={cardClass} />
      </div>
    </div>
  )
}
