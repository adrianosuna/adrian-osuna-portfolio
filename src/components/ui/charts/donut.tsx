'use client'

// Donut sobre Chart.js — portado del componente equivalente del proyecto de
// Inversiones, con dos añadidos que el diseño de aquí necesita y el original
// no traía:
//
//  · TOTAL EN EL CENTRO (plugin propio): es la cifra que se lee primero.
//  · LEYENDA PROPIA en HTML, con importe y porcentaje por fila. La de Chart.js
//    solo muestra la etiqueta, y aquí la tabla de la derecha es la mitad de la
//    información.
import { useEffect, useMemo, useRef } from 'react'
import type { ChartDataset, ChartOptions } from 'chart.js'
import { cn } from '@/lib/utils'
import { Chart, coloresTema, resolverColor, tooltipPlugin } from './comun'

export interface ParteDonut {
  label: string
  valor: number
  color: string
}

export function GraficaDonut({
  partes,
  centro = 'total',
  vacio = 'Sin datos todavía.',
  titulo = 'Composición',
  diametro = 176,
}: {
  partes: ParteDonut[]
  /** Etiqueta bajo el total del centro. */
  centro?: string
  vacio?: string
  /** Título accesible del canvas. */
  titulo?: string
  diametro?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart<'doughnut', number[], string> | null>(null)

  const positivas = useMemo(() => partes.filter((p) => p.valor > 0), [partes])
  const total = useMemo(() => positivas.reduce((s, p) => s + p.valor, 0), [positivas])
  const partesKey = JSON.stringify(positivas)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || total <= 0) return
    const c = coloresTema()

    chartRef.current = new Chart<'doughnut', number[], string>(canvas, {
      type: 'doughnut',
      data: {
        labels: positivas.map((p) => p.label),
        datasets: [
          {
            data: positivas.map((p) => p.valor),
            // resolverColor: las partes llegan con `var(--primary)` y canvas
            // no entiende variables CSS (las pintaría en negro).
            backgroundColor: positivas.map((p) => resolverColor(p.color)),
            borderColor: c.fondo,
            borderWidth: 2,
            // Separación entre arcos, como el hueco del SVG anterior.
            spacing: positivas.length > 1 ? 2 : 0,
            _unidad: 'eur',
          } as unknown as ChartDataset<'doughnut', number[]>,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: '62%',
        plugins: {
          legend: { display: false }, // la leyenda va en HTML, con importes
          tooltip: tooltipPlugin as NonNullable<
            NonNullable<ChartOptions<'doughnut'>['plugins']>['tooltip']
          >,
        },
      },
      plugins: [
        {
          id: 'total-centro',
          afterDraw(chart) {
            const { ctx, chartArea } = chart
            const x = (chartArea.left + chartArea.right) / 2
            const y = (chartArea.top + chartArea.bottom) / 2
            const col = coloresTema()
            ctx.save()
            ctx.textAlign = 'center'
            ctx.fillStyle = col.texto
            ctx.font = '700 17px system-ui, sans-serif'
            ctx.fillText(
              `${total.toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })} €`,
              x,
              y - 1,
            )
            ctx.fillStyle = col.suave
            ctx.font = '10.5px system-ui, sans-serif'
            ctx.fillText(centro, x, y + 15)
            ctx.restore()
          },
        },
      ],
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partesKey, total, centro])

  if (total <= 0) {
    return <p className="py-6 text-center text-[13px] text-muted-foreground">{vacio}</p>
  }

  return (
    <div className="flex flex-col items-center gap-x-6 gap-y-4 sm:flex-row sm:justify-center">
      <div style={{ width: diametro, height: diametro, position: 'relative', flex: 'none' }}>
        <canvas ref={canvasRef} role="img" aria-label={titulo} />
      </div>

      {/* Leyenda propia: una columna, con importe y porcentaje por fila. */}
      <div
        className={cn(
          'flex w-full min-w-0 flex-col sm:w-auto sm:max-w-90 sm:flex-1',
          positivas.length > 8 ? 'gap-1' : 'gap-2',
        )}>
        {partes.map((p) => (
          <div
            key={p.label}
            className={cn(
              'flex items-center gap-2',
              positivas.length > 8 ? 'text-[12.5px]' : 'text-[13px]',
            )}>
            <span
              className="inline-block size-2.5 shrink-0 rounded-xs"
              style={{ background: p.color }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground" title={p.label}>
              {p.label}
            </span>
            <span className="shrink-0 pl-3 font-semibold tabular-nums">
              {Math.max(0, p.valor).toLocaleString('es-ES', {
                maximumFractionDigits: 0,
                useGrouping: 'always',
              })}
              {' €'}
              <span className="ml-1.5 font-normal text-muted-foreground">
                {total > 0
                  ? (Math.max(0, p.valor) / total).toLocaleString('es-ES', {
                      style: 'percent',
                      maximumFractionDigits: 0,
                    })
                  : ''}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
