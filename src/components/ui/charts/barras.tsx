'use client'

// Gráfica de barras sobre Chart.js — portada del componente equivalente del
// proyecto de Inversiones, a TypeScript y al tema oscuro de este proyecto.
//
// Se conserva lo que allí ya estaba resuelto: `animation: false`, deps
// serializadas para no reinstanciar el canvas cuando el padre pasa objetos
// literales, `destroy()` en el cleanup y el click por índice con cursor.
//
// Cambios propios de TypeScript: el chart va tipado como `Chart<'bar'>` y la
// unidad del tooltip viaja en el dataset como prop extra (`_unidad`), que es
// lo que lee el tooltip externo de `comun.ts`.
import { useEffect, useRef } from 'react'
import type { ChartDataset, ChartOptions } from 'chart.js'
import { Chart, coloresTema, registrarFilasExtra, resolverColor, tooltipPlugin } from './comun'
import type { FilaExtra } from './comun'

export interface SerieBarras {
  label: string
  data: number[]
  /** Formato del valor en el tooltip: euros o entero tal cual. */
  _unidad?: 'eur' | 'entero'
  backgroundColor?: string
  stack?: string
}

export function GraficaBarras({
  labels,
  series,
  apiladas = false,
  scales,
  leyenda = false,
  alto = 260,
  className,
  /** Título del tooltip a partir del índice (p. ej. el día en largo). */
  titulo,
  /** Filas añadidas al tooltip que NO son series del gráfico. */
  extra,
  onBarra,
}: {
  labels: string[]
  series: SerieBarras[]
  apiladas?: boolean
  scales?: ChartOptions<'bar'>['scales']
  leyenda?: boolean
  alto?: number
  className?: string
  titulo?: (indice: number) => string
  extra?: (indice: number) => FilaExtra[]
  onBarra?: (indice: number, serie: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart<'bar', number[], string> | null>(null)
  // Refs para los callbacks: así un arrow inline del padre no reinstancia nada.
  const onBarraRef = useRef(onBarra)
  const tituloRef = useRef(titulo)
  const extraRef = useRef(extra)
  useEffect(() => {
    onBarraRef.current = onBarra
    tituloRef.current = titulo
    extraRef.current = extra
  })

  // Deps estables: los literales inline del padre cambian de referencia en cada
  // render. Las funciones (callbacks de ticks) se serializan como '__fn__'.
  const scalesKey = JSON.stringify(scales ?? {}, (_, v) => (typeof v === 'function' ? '__fn__' : v))
  const labelsKey = labels.join('|')
  const seriesKey = JSON.stringify(series)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = coloresTema()

    const datasets = series.map(
      (s) =>
        ({
          borderRadius: 3,
          maxBarThickness: 34,
          backgroundColor: c.primary,
          ...s,
          // Un color por props puede venir como var(--x): canvas lo necesita resuelto.
          ...(s.backgroundColor ? { backgroundColor: resolverColor(s.backgroundColor) } : {}),
        }) as unknown as ChartDataset<'bar', number[]>,
    )

    chartRef.current = new Chart<'bar', number[], string>(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        onClick: (_e, els) => {
          if (els.length) onBarraRef.current?.(els[0].index, els[0].datasetIndex)
        },
        onHover: (e, els) => {
          const target = e.native?.target as HTMLElement | null
          if (onBarraRef.current && target) target.style.cursor = els.length ? 'pointer' : 'default'
        },
        plugins: {
          legend: {
            display: leyenda,
            position: 'top',
            labels: { color: c.suave, boxWidth: 10, boxHeight: 10, font: { size: 12 } },
          },
          // El tooltip externo sirve a los tres tipos de gráfica de la app, pero
          // Chart.js tipa `external` invariante por tipo: de ahí el cast.
          tooltip: {
            ...tooltipPlugin,
            callbacks: {
              title: (items: Array<{ dataIndex: number }>) =>
                tituloRef.current ? tituloRef.current(items[0].dataIndex) : '',
            },
          } as NonNullable<NonNullable<ChartOptions<'bar'>['plugins']>['tooltip']>,
        },
        scales: {
          x: {
            stacked: apiladas,
            grid: { display: false },
            border: { color: c.borde },
            ticks: { color: c.suave, font: { size: 11 }, maxRotation: 0 },
            ...(scales?.x ?? {}),
          },
          y: {
            stacked: apiladas,
            beginAtZero: true,
            grid: { color: c.borde },
            border: { display: false },
            ticks: { color: c.suave, font: { size: 11 }, maxTicksLimit: 5 },
            ...(scales?.y ?? {}),
          },
          ...Object.fromEntries(
            Object.entries(scales ?? {}).filter(([k]) => k !== 'x' && k !== 'y'),
          ),
        },
      },
    })

    // El callback de filas extra va fuera de `options` (ver comun.ts).
    if (extra && chartRef.current) {
      registrarFilasExtra(chartRef.current, (i) => extraRef.current?.(i) ?? [])
    }

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelsKey, seriesKey, apiladas, scalesKey, leyenda])

  return (
    <div className={className} style={{ position: 'relative', height: alto }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
