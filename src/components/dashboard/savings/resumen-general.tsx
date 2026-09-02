'use client'

// Pestaña Resumen del módulo de finanzas: la foto de todos los años — KPIs
// globales, tabla comparativa (cada año enlaza a su pestaña) y la curva de
// ahorro acumulado. Solo lectura: los datos se editan en el tab de cada año.
import Link from 'next/link'
import { BarChart3, LineChart, Percent, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { YearSummary } from '@/lib/finance'
import { AhorroAcumulado } from './charts'
import { ahorroAnualDe, cardClass, eur, pct, proyeccionDe, tasaAhorroDe } from './comun'
import { tdClass, thClass } from '@/components/ui/tabla'

// Clases de la tabla: las comunes de `ui/tabla`.

/** Media de ahorro general por mes relleno (null si no hay ninguno). */
const ritmoDe = (y: YearSummary) => {
  const rellenos = y.generalPorMes.filter((v): v is number => v !== null)
  return rellenos.length ? rellenos.reduce((s, v) => s + v, 0) / rellenos.length : null
}

/** Ahorro general acumulado hasta un mes (para comparar años a la misma altura). */
const hastaMes = (y: YearSummary, mes: number) =>
  y.generalPorMes.slice(0, mes).reduce<number>((s, v) => s + (v ?? 0), 0)

export function ResumenGeneral({ years, hoy }: { years: YearSummary[]; hoy: string }) {
  if (!years.length) {
    return (
      <div className={cn(cardClass, 'py-16 text-center text-muted-foreground')}>
        Todavía no hay ningún año. Crea el primero en la sección Ajustes para empezar a ahorrar.
      </div>
    )
  }

  const mejor = years.reduce((max, y) => (ahorroAnualDe(y) > ahorroAnualDe(max) ? y : max), years[0])
  const totalAhorro = years.reduce((s, y) => s + ahorroAnualDe(y), 0)
  // Los extras también son ingresos (ver tasaAhorroDe): si no, la tasa
  // histórica se infla igual que se inflaba la de cada año.
  const totalIngresos = years.reduce((s, y) => s + y.incomeTotal + y.extrasTotal, 0)
  const tasaHistorica = totalIngresos > 0 ? totalAhorro / totalIngresos : null

  // KPIs útiles = los del año EN CURSO comparados con su objetivo, su ritmo y
  // el año anterior. Los agregados históricos (total, mejor año) ya están en la
  // tabla y la gráfica de abajo: como tarjetas no hacían pensar nada.
  const añoActual = Number(hoy.slice(0, 4))
  const mesActual = Number(hoy.slice(5, 7))
  const actual = years.find((y) => y.year === añoActual)
  const previo = years.find((y) => y.year === añoActual - 1)

  let kpis: Array<{ label: string; valor: string; pie?: React.ReactNode; Icon: typeof TrendingUp }>

  if (actual) {
    const ahorro = ahorroAnualDe(actual)
    const fijos = actual.extrasTotal + (actual.monthsTravel - actual.travelsTotal)
    const proy = proyeccionDe(
      actual.generalPorMes.map((valor, i) => ({ month: i + 1, savingGeneral: valor })),
      fijos,
      actual.goal,
      mesActual,
    )
    const ritmo = ritmoDe(actual)
    const ritmoPrevio = previo ? ritmoDe(previo) : null
    // Comparación justa: mismo número de meses del calendario.
    const mismaAltura = previo ? hastaMes(previo, mesActual) : null
    const deltaAltura = mismaAltura === null ? null : hastaMes(actual, mesActual) - mismaAltura
    const tasaActual = tasaAhorroDe(actual)

    kpis = [
      {
        label: `Ahorrado en ${añoActual}`,
        valor: eur(ahorro),
        Icon: TrendingUp,
        pie: actual.goal
          ? ahorro >= actual.goal
            ? '🎉 objetivo cumplido'
            : `faltan ${eur(actual.goal - ahorro)} para el objetivo`
          : 'sin objetivo fijado',
      },
      {
        label: 'Proyección a cierre de año',
        valor: proy.proyeccion === null ? '—' : eur(proy.proyeccion),
        Icon: LineChart,
        pie:
          proy.proyeccion === null
            ? 'sin meses rellenos'
            : actual.goal
              ? proy.proyeccion >= actual.goal
                ? 'a este ritmo, da para el objetivo'
                : `a este ritmo se queda a ${eur(actual.goal - proy.proyeccion)}`
              : 'a ritmo de los meses rellenos',
      },
      {
        label: `Frente a ${añoActual - 1} a estas alturas`,
        valor: deltaAltura === null ? '—' : `${deltaAltura >= 0 ? '+' : '−'}${eur(Math.abs(deltaAltura))}`,
        Icon: deltaAltura !== null && deltaAltura < 0 ? TrendingDown : TrendingUp,
        pie:
          deltaAltura === null
            ? 'sin año anterior con el que comparar'
            : `${eur(hastaMes(actual, mesActual))} frente a ${eur(mismaAltura!)} en ${mesActual} meses`,
      },
      {
        label: 'Ritmo mensual',
        valor: ritmo === null ? '—' : `${eur(ritmo)}/mes`,
        Icon: BarChart3,
        pie:
          ritmoPrevio === null || ritmo === null
            ? `tasa de ahorro ${pct(tasaActual)}`
            : `en ${añoActual - 1}: ${eur(ritmoPrevio)}/mes · tasa ${pct(tasaActual)}`,
      },
    ]
  } else {
    // Sin año en curso (o solo histórico): los agregados sí son lo útil.
    kpis = [
      { label: 'Ahorro total histórico', valor: eur(totalAhorro), Icon: TrendingUp },
      { label: 'Media anual de ahorro', valor: eur(totalAhorro / years.length), Icon: BarChart3 },
      { label: 'Tasa de ahorro histórica', valor: pct(tasaHistorica), Icon: Percent },
      { label: 'Mejor año de ahorro', valor: `${mejor.year} · ${eur(ahorroAnualDe(mejor))}`, Icon: Trophy },
    ]
  }

  // Curva de ahorro acumulado: suma corrida del ahorro anual, año a año.
  const acumulado = years.reduce<Array<{ year: number; valor: number }>>((acc, y) => {
    const previo = acc.length ? acc[acc.length - 1].valor : 0
    return [...acc, { year: y.year, valor: previo + ahorroAnualDe(y) }]
  }, [])

  return (
    <div>
      {/* KPIs: el año en curso frente a su objetivo, su ritmo y el año pasado */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={cn(cardClass, 'p-4')}>
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <k.Icon className="size-4 shrink-0 text-primary" /> {k.label}
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">{k.valor}</p>
            {k.pie && <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{k.pie}</p>}
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
                    {y.goal ? `${Math.round((ahorroAnualDe(y) / y.goal) * 100)} % de ${eur(y.goal)}` : '—'}
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
                    ? `Objetivo: ${Math.round((ahorroAnualDe(y) / y.goal) * 100)} % de ${eur(y.goal)}`
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
            <AhorroAcumulado puntos={acumulado} />
          </div>
        )}
      </div>
    </div>
  )
}
