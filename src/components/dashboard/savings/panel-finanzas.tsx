'use client'

// Panel de Finanzas: el ahorro del año (objetivo, proyección, ritmo) y el mes en
// curso de movimientos. Cada bloque enlaza a su sección.
import Link from 'next/link'
import { ArrowUpRight, PiggyBank, Receipt, Scale, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { YearSummary } from '@/lib/finance'
import type { MesMovimientos } from '@/lib/gastos'
import { nombreMes as mesDe } from '@/lib/fechas'
import { GraficaDonut } from '@/components/ui/charts/donut'
import { ahorroAnualDe, cardClass, esperadoHoy, eur, eurEntero, pct, proyeccionDe, tasaAhorroDe } from './comun'
import { TarjetaCifra } from '@/components/dashboard/tarjeta-cifra'



function Cabecera({ titulo, href, enlace }: { titulo: string; href: string; enlace: string }) {
  return (
    // min-w-0 en el título y shrink-0 en el enlace: con un título largo el enlace se
    // comprimía y se partía en dos líneas.
    <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
      {/* `h2`: primer nivel bajo el `h1` de la página (orden de encabezados). */}
      <h2 className="min-w-0 font-semibold">{titulo}</h2>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap py-1 text-[12.5px] font-semibold text-primary hover:underline">
        {enlace} <ArrowUpRight className="size-3.5" />
      </Link>
    </div>
  )
}

function Dato({ label, valor, tono }: { label: string; valor: string; tono?: 'success' | 'danger' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/8 py-2 last:border-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          'shrink-0 text-[13.5px] font-semibold tabular-nums',
          tono === 'success' && 'text-success',
          tono === 'danger' && 'text-danger',
        )}>
        {valor}
      </span>
    </div>
  )
}

export function PanelFinanzas({
  years, mes, hoy,
}: {
  years: YearSummary[]
  /** Mes en curso del control de movimientos. */
  mes: MesMovimientos
  hoy: string // 'YYYY-MM-DD' (Madrid)
}) {
  const añoActual = Number(hoy.slice(0, 4))
  const mesActual = Number(hoy.slice(5, 7))
  const actual = years.find((y) => y.year === añoActual)

  // ── Ahorro del año en curso ──
  const ahorro = actual ? ahorroAnualDe(actual) : null
  const pctObjetivo = actual?.goal && ahorro !== null ? Math.round((ahorro / actual.goal) * 100) : null
  const esperado = actual?.goal ? esperadoHoy(actual.goal, añoActual, hoy) : null
  const desvio = esperado !== null && ahorro !== null ? ahorro - esperado : null
  const proy = actual
    ? proyeccionDe(
        actual.generalPorMes.map((valor, i) => ({ month: i + 1, savingGeneral: valor })),
        actual.extrasTotal + (actual.monthsTravel - actual.travelsTotal),
        actual.goal,
        mesActual,
      )
    : null
  const rellenos = actual?.generalPorMes.filter((v): v is number => v !== null) ?? []
  const ritmo = rellenos.length ? rellenos.reduce((s, v) => s + v, 0) / rellenos.length : null

  const nIngresos = mes.movimientos.filter((m) => m.type === 'INGRESO').length

  // El panel es un resumen: con doce categorías la leyenda hacía la tarjeta de 568 px
  // en móvil. Cinco primeras y el resto agrupado.
  const TOPE = 5
  const gastoTop = mes.porCategoriaGasto.slice(0, TOPE).map((c) => ({
    label: c.name, valor: c.total, color: c.color,
  }))
  const resto = mes.porCategoriaGasto.slice(TOPE)
  const partesGasto = resto.length
    ? [...gastoTop, {
        label: `Otras ${resto.length} categorías`,
        valor: resto.reduce((sum, c) => sum + c.total, 0),
        color: '#64748b',
      }]
    : gastoTop
  const nombreMes = mesDe(mesActual)
  const enlaceGastos = `/app/finance?s=gastos&mes=${mes.mes}`

  return (
    <div>
      {/* Las cuatro cifras que resumen el mes y el año */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaCifra
          label={`Ahorrado en ${añoActual}`}
          valor={ahorro === null ? '—' : eurEntero(ahorro)}
          icono={<PiggyBank className="size-4" />}
          tono="primary"
          to="/app/finance?s=ahorro"
          pie={
            !actual ? (
              'sin año creado'
            ) : pctObjetivo === null ? (
              'sin objetivo fijado'
            ) : (
              // En móvil la barra va debajo del porcentaje: a su lado, en media
              // pantalla, se quedaba en 40 px.
              <span className="flex flex-col gap-1.5 sm:flex-row-reverse sm:items-center sm:gap-2">
                <span className="shrink-0 tabular-nums">{pctObjetivo}&nbsp;%</span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-white/8 sm:flex-1">
                  <span
                    className={cn('block h-full rounded-full', pctObjetivo >= 100 ? 'bg-success' : 'bg-primary')}
                    style={{ width: `${Math.min(100, pctObjetivo)}%` }}
                  />
                </span>
              </span>
            )
          }
        />
        <TarjetaCifra
          label={`Ingresos de ${nombreMes}`}
          valor={eurEntero(mes.ingresos)}
          icono={<TrendingUp className="size-4" />}
          tono="success"
          to={enlaceGastos}
          // Los ingresos del mes, no TODOS los movimientos: bajo "Ingresos de
          // Agosto", leer "32 movimientos apuntados" hacía pensar en 32 ingresos.
          pie={`${nIngresos} ${nIngresos === 1 ? 'ingreso' : 'ingresos'} apuntados`}
        />
        <TarjetaCifra
          label={`Gastos de ${nombreMes}`}
          valor={eurEntero(mes.gastos)}
          icono={<Receipt className="size-4" />}
          tono="danger"
          to={enlaceGastos}
          pie={
            mes.gastosPrevios <= 0 ? (
              'sin dato del mes anterior'
            ) : (
              (() => {
                const delta = Math.round(((mes.gastos - mes.gastosPrevios) / mes.gastosPrevios) * 100)
                if (delta === 0) return 'igual que el mes anterior'
                const sube = delta > 0
                return (
                  <span className={cn('inline-flex items-center gap-1', sube ? 'text-danger' : 'text-success')}>
                    {sube ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {sube ? '+' : ''}
                    {delta}&nbsp;% frente al mes pasado
                  </span>
                )
              })()
            )
          }
        />
        <TarjetaCifra
          label={`Balance de ${nombreMes}`}
          valor={eurEntero(mes.balance)}
          icono={<Scale className="size-4" />}
          tono={mes.balance >= 0 ? 'success' : 'danger'}
          to={enlaceGastos}
          pie={mes.balance >= 0 ? 'te queda a favor' : 'has gastado más de lo que entró'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Bloque de ahorro */}
        <div className={cardClass}>
          <Cabecera titulo={`Ahorro ${añoActual}`} href="/app/finance?s=ahorro" enlace="Ir al ahorro" />
          <div className="px-5 py-3">
            {!actual ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                Todavía no hay año creado. Créalo desde la sección Ajustes.
              </p>
            ) : (
              <>
                <Dato label="Ahorrado" valor={eur(ahorro ?? 0)} />
                <Dato
                  label="Objetivo del año"
                  valor={actual.goal ? eur(actual.goal) : 'sin fijar'}
                />
                {desvio !== null && (
                  <Dato
                    label="Frente a lo que tocaría hoy"
                    valor={`${desvio >= 0 ? '+' : '−'}${eur(Math.abs(desvio))}`}
                    tono={desvio >= 0 ? 'success' : 'danger'}
                  />
                )}
                <Dato
                  label="Proyección a cierre"
                  valor={proy?.proyeccion === null || proy === null ? '—' : eur(proy.proyeccion)}
                />
                <Dato label="Ritmo mensual" valor={ritmo === null ? '—' : `${eur(ritmo)}/mes`} />
                <Dato label="Tasa de ahorro" valor={pct(tasaAhorroDe(actual))} />
              </>
            )}
          </div>
        </div>

        {/* Bloque de gastos: en qué se va el dinero este mes */}
        <div className={cardClass}>
          <Cabecera titulo={`En qué se va el dinero en ${nombreMes}`} href={enlaceGastos} enlace="Ir a gastos" />
          <div className="px-5 py-4">
            <GraficaDonut
              titulo={`En qué se va el dinero en ${nombreMes}`}
              centro="gastado"
              vacio="Sin gastos apuntados este mes."
              partes={partesGasto}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
