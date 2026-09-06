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
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { Chart, coloresTema, resolverColor, tooltipPlugin } from './comun'

export interface ParteDonut {
  /** Identificador de quien la usa, para reconocerla en `onParte` sin tener
   *  que emparejarla por la etiqueta. */
  id?: string | null
  label: string
  valor: number
  color: string
  /** Con `onParte`, si ESTA porción responde al clic. Las que no, se pintan
   *  como siempre: un cursor de mano sobre algo que no hace nada es peor que
   *  no ofrecerlo. */
  pulsable?: boolean
}

export function GraficaDonut({
  partes,
  centro = 'total',
  vacio = 'Sin datos todavía.',
  titulo = 'Composición',
  diametro = 176,
  onParte,
}: {
  partes: ParteDonut[]
  /** Etiqueta bajo el total del centro. */
  centro?: string
  vacio?: string
  /** Título accesible del canvas. */
  titulo?: string
  diametro?: number
  /**
   * Qué hacer al activar una porción `pulsable` (bajar a su desglose, filtrar,
   * abrir una vista...). Sin esto el donut es de solo lectura, que es como lo
   * usan la mayoría de las tarjetas.
   *
   * El componente no sabe QUÉ significa el clic: eso lo decide quien lo usa.
   */
  onParte?: (parte: ParteDonut) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart<'doughnut', number[], string> | null>(null)
  // En un ref para que cambiar el manejador no reconstruya la gráfica: el
  // efecto de abajo solo depende de los datos. Se refresca en su propio
  // efecto y no durante el render, que es escribir en un ref mientras React
  // pinta (y lo avisa la regla `react-hooks/refs`).
  const onParteRef = useRef(onParte)
  useEffect(() => {
    onParteRef.current = onParte
  }, [onParte])

  const positivas = useMemo(() => partes.filter((p) => p.valor > 0), [partes])
  // ¿Alguna porción abre desglose? Decide si la leyenda reserva la columna del
  // chevron (ver el comentario de la fila).
  const hayPulsables = Boolean(onParte) && partes.some((p) => p.pulsable)
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
        // El clic en el arco es un extra para el ratón: el camino accesible
        // (y el del móvil) son las filas de la leyenda, que sí son botones.
        onClick: (_e, elementos) => {
          const parte = positivas[elementos[0]?.index ?? -1]
          if (parte?.pulsable) onParteRef.current?.(parte)
        },
        onHover: (e, elementos) => {
          const canvas = e.native?.target as HTMLCanvasElement | undefined
          if (!canvas) return
          canvas.style.cursor = positivas[elementos[0]?.index ?? -1]?.pulsable ? 'pointer' : 'default'
        },
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
        {partes.map((p) => {
          const pulsable = Boolean(onParte && p.pulsable)
          const clase = cn(
            'flex w-full items-center gap-2',
            positivas.length > 8 ? 'text-[12.5px]' : 'text-[13px]',
            // ⚠ El padding va en TODAS las filas del donut, no solo en la
            // pulsable. Antes la pulsable llevaba `-mx-1 px-1` para que el
            // fondo del hover sangrara, pero `w-full` no crece con el margen
            // negativo: su área de contenido quedaba 8 px más estrecha y su
            // importe se iba a la izquierda del resto. Mismo padding en todas
            // = misma geometría, y el fondo del hover encaja con la fila.
            hayPulsables && 'px-1',
            pulsable &&
              'cursor-pointer rounded-sm text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
          )
          // El contenido se declara una vez y solo cambia el envoltorio: una
          // fila pulsable tiene que ser un BOTÓN de verdad porque el canvas
          // DIBUJA su texto (no es DOM), así que sin esto el desglose no
          // existiría ni para el teclado ni para un lector de pantalla.
          const contenido = (
            <>
              <span
                className="inline-block size-2.5 shrink-0 rounded-xs"
                style={{ background: p.color }}
              />
              <Tooltip texto={p.label}>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.label}</span>
              </Tooltip>
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
              {/* ⚠ La columna del chevron se reserva en TODAS las filas de la
                  leyenda (con un hueco vacío en las que no son pulsables), no
                  solo en las que lo llevan. Si no, el importe y el porcentaje
                  de la fila del grupo quedan 22 px a la izquierda de los
                  demás y la columna de cifras deja de estar a plomo — se ve
                  desalineada al instante, y en una leyenda de cifras eso es
                  lo primero que canta.
                  Solo cuando este donut tiene alguna porción pulsable: los
                  demás (el ahorro, los ingresos) no cambian ni un píxel. */}
              {hayPulsables &&
                (pulsable ? (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <span className="size-3.5 shrink-0" aria-hidden />
                ))}
            </>
          )
          return pulsable ? (
            <button
              key={p.label}
              type="button"
              className={clase}
              aria-label={`${p.label}: ver el desglose`}
              onClick={() => onParte?.(p)}>
              {contenido}
            </button>
          ) : (
            <div key={p.label} className={clase}>
              {contenido}
            </div>
          )
        })}
      </div>
    </div>
  )
}
