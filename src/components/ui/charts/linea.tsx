'use client'

// Gráfica de línea sobre Chart.js — portada del componente equivalente del
// proyecto de Inversiones, a TypeScript y al tema oscuro.
//
// Del original se conservan `animation: false`, `tension: 0.35`, el área
// rellena opcional, las deps serializadas y el `destroy()` en el cleanup.
import { useEffect, useRef } from 'react'
import type { ChartDataset, ChartOptions } from 'chart.js'
import { Chart, coloresTema, resolverColor, tooltipPlugin } from './comun'

export interface SerieLinea {
  label: string
  data: number[]
  color?: string
  /** Formato del valor en el tooltip. */
  _unidad?: 'eur' | 'entero'
}

export function GraficaLinea({
  labels,
  series,
  relleno = true,
  scales,
  leyenda = false,
  alto = 220,
  className,
  titulo,
  /** Escribe el valor sobre cada punto (como hacía la gráfica de acumulado). */
  valoresEncima = false,
  formatoValor,
}: {
  labels: string[]
  series: SerieLinea[]
  relleno?: boolean
  scales?: ChartOptions<'line'>['scales']
  leyenda?: boolean
  alto?: number
  className?: string
  titulo?: (indice: number) => string
  valoresEncima?: boolean
  formatoValor?: (v: number) => string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart<'line', number[], string> | null>(null)
  const tituloRef = useRef(titulo)
  const formatoRef = useRef(formatoValor)
  useEffect(() => {
    tituloRef.current = titulo
    formatoRef.current = formatoValor
  })

  const scalesKey = JSON.stringify(scales ?? {}, (_, v) => (typeof v === 'function' ? '__fn__' : v))
  const labelsKey = labels.join('|')
  const seriesKey = JSON.stringify(series)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = coloresTema()

    const datasets = series.map((s) => {
      const color = resolverColor(s.color ?? c.primary)
      return {
        borderColor: color,
        backgroundColor: relleno ? `${color}22` : color,
        fill: relleno,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: c.fondo,
        pointBorderColor: color,
        pointBorderWidth: 2.5,
        ...s,
      } as unknown as ChartDataset<'line', number[]>
    })

    chartRef.current = new Chart<'line', number[], string>(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        // Espacio arriba para el valor escrito sobre el punto.
        layout: { padding: { top: valoresEncima ? 18 : 4 } },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: leyenda,
            position: 'top',
            labels: { color: c.suave, boxWidth: 10, boxHeight: 10, font: { size: 12 } },
          },
          tooltip: {
            ...tooltipPlugin,
            callbacks: {
              title: (items: Array<{ dataIndex: number }>) =>
                tituloRef.current ? tituloRef.current(items[0].dataIndex) : '',
            },
          } as NonNullable<NonNullable<ChartOptions<'line'>['plugins']>['tooltip']>,
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: c.borde },
            ticks: { color: c.suave, font: { size: 11 }, maxRotation: 0 },
            ...(scales?.x ?? {}),
          },
          y: {
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
      plugins: valoresEncima
        ? [
            {
              id: 'valores-encima',
              afterDatasetsDraw(chart) {
                const { ctx } = chart
                ctx.save()
                ctx.font = '600 10.5px system-ui, sans-serif'
                ctx.fillStyle = coloresTema().suave
                ctx.textAlign = 'center'
                chart.data.datasets.forEach((_, di) => {
                  chart.getDatasetMeta(di).data.forEach((punto, i) => {
                    const v = (chart.data.datasets[di].data as number[])[i]
                    const texto = formatoRef.current ? formatoRef.current(v) : String(v)
                    ctx.fillText(texto, punto.x, punto.y - 11)
                  })
                })
                ctx.restore()
              },
            },
          ]
        : [],
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelsKey, seriesKey, relleno, scalesKey, leyenda, valoresEncima])

  return (
    <div className={className} style={{ position: 'relative', height: alto }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
