'use client'

// Base compartida de las gráficas: registro selectivo de Chart.js (auto pesa
// ~200 KB), colores resueltos desde los tokens (canvas no entiende var()) y tooltip oscuro.
import { filaTooltip, marcoTooltip, mostrarTooltip, ocultarTooltip } from './tooltip'
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type TooltipModel,
} from 'chart.js'

Chart.register(
  BarController, BarElement,
  LineController, LineElement, PointElement, Filler,
  DoughnutController, ArcElement,
  CategoryScale, LinearScale,
  Tooltip, Legend,
)

export { Chart }

/** Token del tema resuelto a color real (canvas no entiende `var()`). */
export const token = (nombre: string, respaldo = '#10b981') => {
  if (typeof window === 'undefined') return respaldo
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim()
  return v || respaldo
}

/** Resuelve un `var(--token)` al color real: canvas lo pintaría en negro. Acepta
 *  el respaldo del propio var(). */
export const resolverColor = (color: string, respaldo = '#94a3b8'): string => {
  const c = color.trim()
  if (!c.startsWith('var(') || !c.endsWith(')')) return color
  // Dentro del var(): el token y, opcionalmente, su valor de respaldo.
  const dentro = c.slice(4, -1)
  const coma = dentro.indexOf(',')
  const nombre = (coma === -1 ? dentro : dentro.slice(0, coma)).trim()
  const alternativo = coma === -1 ? '' : dentro.slice(coma + 1).trim()
  if (!nombre.startsWith('--')) return color
  return token(nombre, alternativo || respaldo)
}

/** Colores del tema que usan las gráficas. Se leen en cada montaje: son baratos
 *  y así un cambio de tokens no deja colores viejos cacheados. */
export const coloresTema = () => ({
  primary: token('--primary'),
  success: token('--success', '#22c55e'),
  danger: token('--danger', '#ef4444'),
  warning: token('--warning', '#f59e0b'),
  viajes: token('--viajes', '#38bdf8'),
  texto: token('--foreground', '#e6f2ec'),
  suave: token('--muted-foreground', '#94a3b8'),
  borde: token('--border', '#1e3a32'),
  fondo: token('--popover', '#0f1d18'),
})

/** Euros sin decimales, con agrupación de miles siempre (es-ES no agrupa las
 *  cifras de 4 dígitos por defecto). Igual criterio que el resto de la app. */
export const eur = (v: number) =>
  `${v.toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })} €`

type Unidad = 'eur' | 'entero'

export interface FilaExtra {
  nombre: string
  valor: string
  color?: string
}

/** Filas de tooltip que no son series. En un WeakMap y no en `options`: Chart.js
 *  invoca cualquier función de las opciones como "scriptable option" y revienta. */
const extras = new WeakMap<object, (indice: number) => FilaExtra[]>()

export const registrarFilasExtra = (chart: object, fn: (indice: number) => FilaExtra[]) =>
  extras.set(chart, fn)

/** Tooltip de Chart.js traducido a las filas del tooltip compartido
 *  (ui/charts/tooltip.ts), el mismo del mapa de calor. */
const tooltipExterno = (ctx: {
  chart: Chart
  tooltip: TooltipModel<'bar' | 'line' | 'doughnut'>
}) => {
  const { chart, tooltip } = ctx
  if (tooltip.opacity === 0) return ocultarTooltip()

  const puntos = tooltip.dataPoints ?? []
  const esCircular =
    (puntos[0]?.dataset as { type?: string } | undefined)?.type === 'doughnut' ||
    (chart as { config: { type?: string } }).config.type === 'doughnut'
  const total = esCircular
    ? (puntos[0]?.dataset.data as number[]).reduce((a, b) => a + (Number(b) || 0), 0)
    : 0

  const hayTitulo = Boolean(tooltip.title?.length)
  const filas = puntos
    .map((dp) => {
      const ds = dp.dataset as { label?: string; _unidad?: Unidad; backgroundColor?: unknown }
      const color =
        (dp.element as { options?: { backgroundColor?: string } })?.options?.backgroundColor ??
        (typeof ds.backgroundColor === 'string' ? ds.backgroundColor : undefined)
      // Con varias series, o cuando el título ya dice el punto, la fila lleva el
      // nombre de la SERIE; si no, la etiqueta del eje.
      const nombre =
        (chart.data.datasets.length > 1 || hayTitulo) && ds.label ? ds.label : String(dp.label)
      const n =
        typeof dp.parsed === 'object' ? ((dp.parsed as { y: number }).y ?? 0) : Number(dp.parsed)
      const pct = total ? ` (${Math.round((n / total) * 100)} %)` : ''
      const valor = (ds._unidad === 'eur' ? eur(n) : dp.formattedValue) + pct
      return filaTooltip({ color, nombre, valor })
    })
    .join('')

  // Filas que no son series del gráfico: las registra la gráfica aparte.
  const extra = extras.get(chart)
  const filasExtra = extra
    ? extra(puntos[0]?.dataIndex ?? 0)
        .map((f) => filaTooltip(f))
        .join('')
    : ''

  // Coordenadas de viewport: el canvas puede estar dentro de un scroller.
  const r = chart.canvas.getBoundingClientRect()
  mostrarTooltip(
    marcoTooltip(filas + filasExtra, hayTitulo ? tooltip.title[0] : undefined),
    r.left + tooltip.caretX,
    r.top + tooltip.caretY,
  )
}

export const tooltipPlugin = { enabled: false, external: tooltipExterno }
