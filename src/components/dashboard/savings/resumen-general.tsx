'use client'

// Pestaña Resumen del módulo de finanzas: la foto de todos los años — KPIs
// globales, tabla comparativa (cada año enlaza a su pestaña) y la curva de
// ahorro acumulado. Solo lectura: los datos se editan en el tab de cada año.
import Link from 'next/link'
import { BarChart3, Compass, Percent, TrendingUp, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { YearSummary } from '@/lib/finance'
import { AcumuladoChart } from './charts'
import { ahorroAnualDe, cardClass, eur, pct, tasaAhorroDe } from './comun'

const thClass = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground'
const tdClass = 'px-3 py-1.5'

export function ResumenGeneral({ years }: { years: YearSummary[] }) {
  if (!years.length) {
    return (
      <div className={cn(cardClass, 'py-16 text-center text-muted-foreground')}>
        Todavía no hay ningún año. Crea el primero desde «Gestionar años» para empezar a ahorrar.
      </div>
    )
  }

  const mejor = years.reduce((max, y) => (ahorroAnualDe(y) > ahorroAnualDe(max) ? y : max), years[0])
  const totalAhorro = years.reduce((s, y) => s + ahorroAnualDe(y), 0)
  const totalIngresos = years.reduce((s, y) => s + y.incomeTotal, 0)
  const kpis = [
    { label: 'Ahorro total histórico', valor: eur(totalAhorro), Icon: TrendingUp },
    { label: 'Tasa de ahorro histórica', valor: pct(totalIngresos > 0 ? totalAhorro / totalIngresos : null), Icon: Percent },
    { label: 'Media anual de ahorro', valor: eur(totalAhorro / years.length), Icon: BarChart3 },
    { label: 'Ahorrado para viajes (histórico)', valor: eur(years.reduce((s, y) => s + y.monthsTravel, 0)), Icon: Compass },
    { label: 'Mejor año de ahorro', valor: `${mejor.year} · ${eur(ahorroAnualDe(mejor))}`, Icon: Trophy },
  ]

  // Curva de ahorro acumulado: suma corrida del ahorro anual, año a año.
  const acumulado = years.reduce<Array<{ year: number; valor: number }>>((acc, y) => {
    const previo = acc.length ? acc[acc.length - 1].valor : 0
    return [...acc, { year: y.year, valor: previo + ahorroAnualDe(y) }]
  }, [])

  return (
    <div>
      {/* KPIs globales */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className={cn(cardClass, 'p-5')}>
            <p className="mb-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
              <k.Icon className="size-4 text-primary" /> {k.label}
            </p>
            <p className="text-2xl font-semibold">{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Tabla comparativa de años (tarjetas en móvil) */}
      <div className={cn(cardClass, 'mt-4')}>
        <h3 className="border-b border-border px-5 py-3 font-semibold">Todos los años</h3>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={thClass}>Año</th>
                <th className={cn(thClass, 'text-right')}>Ahorro anual</th>
                <th className={cn(thClass, 'text-right')}>Tasa de ahorro</th>
                <th className={cn(thClass, 'text-right')}>Objetivo</th>
                <th className={cn(thClass, 'text-right')}>Ahorro viajes</th>
                <th className={cn(thClass, 'text-right')}>Ahorro acumulado</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y, i) => (
                <tr key={y.uuid} className="border-b border-border/50">
                  <td className={cn(tdClass, 'py-2.5 font-semibold')}>
                    <Link href={`/app/finance?year=${y.year}`} className="text-primary hover:underline">
                      {y.year}
                    </Link>
                  </td>
                  <td className={cn(tdClass, 'text-right')}>{eur(ahorroAnualDe(y))}</td>
                  <td className={cn(tdClass, 'text-right')}>{pct(tasaAhorroDe(y))}</td>
                  <td className={cn(tdClass, 'text-right')}>
                    {y.goal ? `${Math.round((ahorroAnualDe(y) / y.goal) * 100)}% de ${eur(y.goal)}` : '—'}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>{eur(y.monthsTravel)}</td>
                  <td className={cn(tdClass, 'text-right font-semibold text-primary')}>{eur(acumulado[i].valor)}</td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-semibold">
                <td className={tdClass}>TOTAL</td>
                <td className={cn(tdClass, 'text-right')}>{eur(totalAhorro)}</td>
                <td className={cn(tdClass, 'text-right')}>{pct(totalIngresos > 0 ? totalAhorro / totalIngresos : null)}</td>
                <td className={tdClass} />
                <td className={cn(tdClass, 'text-right')}>{eur(years.reduce((s, y) => s + y.monthsTravel, 0))}</td>
                <td className={tdClass} />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Móvil: una tarjeta por año, y la tarjeta entera lleva a su pestaña */}
        <div className="flex flex-col gap-2 p-3 md:hidden">
          {years.map((y, i) => (
            <Link
              key={y.uuid}
              href={`/app/finance?year=${y.year}`}
              className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary">{y.year}</span>
                <span className="text-sm font-semibold">{eur(ahorroAnualDe(y))}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {y.goal
                    ? `Objetivo: ${Math.round((ahorroAnualDe(y) / y.goal) * 100)}% de ${eur(y.goal)}`
                    : 'Sin objetivo'}
                </span>
                <span>Tasa {pct(tasaAhorroDe(y))}</span>
                <span>Acum. {eur(acumulado[i].valor)}</span>
              </div>
            </Link>
          ))}
          <p className="px-1 pt-1 text-right text-[13px] text-muted-foreground">
            Total ahorrado <span className="font-semibold text-foreground">{eur(totalAhorro)}</span>
          </p>
        </div>

        {years.length > 1 && (
          <div className="overflow-x-auto border-t border-border px-4 pb-2 pt-4">
            <p className="mb-2 text-[13px] font-semibold text-muted-foreground">Ahorro acumulado</p>
            <AcumuladoChart puntos={acumulado} />
          </div>
        )}
      </div>
    </div>
  )
}
