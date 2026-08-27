'use client'

// Gráficas SVG del sistema de ahorro (sin librerías de charts, para no engordar
// el bundle): barras mensuales apiladas y línea de ahorro acumulado por años.
// Los colores salen de los tokens del tema (funcionan en claro y oscuro).
import { cn } from '@/lib/utils'
import { useAncho } from '@/components/ui/use-ancho'
import type { MonthRow } from '@/lib/finance'

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// useGrouping siempre: es-ES no agrupa los números de 4 cifras por defecto.
const eurCorto = (v: number) =>
  v.toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' }) + ' €'

// Barras apiladas por mes: ahorro general + ahorro para viajes. El lienzo se
// ajusta al hueco; por debajo de ~420px va apretado (meses a una letra, eje
// abreviado en "1,2k" y menos guías) para caber en un móvil sin scroll.
export function MonthlyChart({ months }: { months: MonthRow[] }) {
  const [ref, ancho] = useAncho()
  const compacto = ancho > 0 && ancho < 420
  const W = ancho || 760
  const H = compacto ? 185 : Math.min(280, Math.max(220, Math.round(W * 0.26)))
  const padL = compacto ? 36 : 60
  const padB = compacto ? 22 : 26
  const padT = compacto ? 10 : 14
  const padR = compacto ? 6 : 12
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const totalDe = (m: MonthRow) => (m.savingGeneral || 0) + (m.savingTravel || 0)
  const max = Math.max(...months.map(totalDe), 1)
  // Techo "redondo" para que las líneas de guía caigan en cifras legibles.
  const step = Math.pow(10, Math.max(1, String(Math.ceil(max)).length - 1))
  const top = Math.ceil(max / step) * step

  const bw = (innerW / 12) * 0.52
  const x = (i: number) => padL + (innerW / 12) * i + (innerW / 12 - bw) / 2
  const y = (v: number) => padT + innerH - (v / top) * innerH

  const guides = compacto ? [0.5, 1] : [0.25, 0.5, 0.75, 1]
  const fmtEje = (v: number) =>
    compacto
      ? v >= 1000
        ? `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k`
        : String(Math.round(v))
      : eurCorto(v)
  const fuente = compacto ? 10 : 10.5

  return (
    <div ref={ref} className="w-full" style={{ minHeight: H }}>
      {ancho > 0 && (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto block h-auto w-full"
      style={{ maxHeight: H }}
      role="img"
      aria-label="Ahorro por mes">
      {guides.map((g) => (
        <g key={g}>
          <line
            x1={padL} y1={y(top * g)} x2={W - padR} y2={y(top * g)}
            stroke="var(--border)" strokeWidth="1" strokeDasharray={g === 1 ? '' : '3 4'} />
          <text x={padL - 6} y={y(top * g) + 4} textAnchor="end" fontSize={fuente} fill="var(--muted-foreground)">
            {fmtEje(top * g)}
          </text>
        </g>
      ))}
      <line x1={padL} y1={y(0)} x2={W - padR} y2={y(0)} stroke="var(--border)" strokeWidth="1" />

      {/* Barras apiladas (general abajo, viajes encima) */}
      {months.map((m, i) => {
        const general = m.savingGeneral || 0
        const travel = m.savingTravel || 0
        return (
          <g key={m.month}>
            <title>{`${MESES_CORTOS[i]}: ${eurCorto(general)} general + ${eurCorto(travel)} viajes`}</title>
            {general > 0 && (
              <rect x={x(i)} y={y(general)} width={bw} height={y(0) - y(general)} rx="3" fill="var(--primary)" />
            )}
            {travel > 0 && (
              <rect
                x={x(i)} y={y(general + travel)} width={bw}
                height={y(general) - y(general + travel)} rx="3" fill="var(--viajes)" opacity="0.85" />
            )}
            <text x={x(i) + bw / 2} y={H - 8} textAnchor="middle" fontSize={fuente} fill="var(--muted-foreground)">
              {compacto ? MESES_CORTOS[i][0] : MESES_CORTOS[i]}
            </text>
          </g>
        )
      })}
    </svg>
      )}
    </div>
  )
}

// Donut con la composición del ahorro anual: qué peso tienen el ahorro
// mensual, los ingresos extraordinarios y el sobrante de viajes. Cada parte
// se pinta como arco de circunferencia (dasharray sobre un círculo girado).
export function DonutAhorro({
  partes, centro = 'ahorro anual', vacio = 'Sin datos de ahorro todavía.',
  titulo = 'Composición del ahorro anual',
}: {
  partes: Array<{ label: string; valor: number; color: string }>
  /** Etiqueta bajo el total del centro. */
  centro?: string
  /** Texto cuando no hay nada que repartir. */
  vacio?: string
  /** Título accesible del SVG (se reutiliza en los desgloses de gastos). */
  titulo?: string
}) {
  const positivas = partes.filter((p) => p.valor > 0)
  const total = positivas.reduce((s, p) => s + p.valor, 0)
  if (total <= 0) {
    return <p className="py-6 text-center text-[13px] text-muted-foreground">{vacio}</p>
  }

  const R = 62
  const C = 2 * Math.PI * R
  // Separación entre arcos. Con muchas categorías (los desgloses de gastos
  // llegan a más de diez) un hueco fijo se come las porciones del 1%: se
  // reduce a partir de seis partes para que ninguna desaparezca.
  const HUECO = positivas.length > 6 ? 0.004 : 0.012
  const arcos = positivas.reduce<Array<{ p: (typeof positivas)[number]; desde: number; frac: number }>>(
    (acc, p) => {
      const desde = acc.length ? acc[acc.length - 1].desde + acc[acc.length - 1].frac : 0
      return [...acc, { p, desde, frac: p.valor / total }]
    },
    [],
  )

  return (
    <div className="flex flex-col items-center gap-x-6 gap-y-4 sm:flex-row sm:justify-center">
      <svg viewBox="0 0 180 180" className="size-44 shrink-0" role="img" aria-label={titulo}>
        {arcos.map(({ p, desde, frac }) => (
          <circle
            key={p.label}
            cx="90" cy="90" r={R}
            fill="none"
            stroke={p.color}
            strokeWidth="26"
            // Suelo de 1,5px: una parte diminuta junto a otra dominante (una
            // propina frente a la nómina) se vería como un hueco, no como dato.
            strokeDasharray={`${Math.max(1.5, (frac - (positivas.length > 1 ? HUECO : 0)) * C)} ${C}`}
            strokeDashoffset={-desde * C}
            transform="rotate(-90 90 90)">
            <title>{`${p.label}: ${eurCorto(p.valor)} (${Math.round(frac * 100)} %)`}</title>
          </circle>
        ))}
        <text x="90" y="86" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--foreground)">
          {eurCorto(total)}
        </text>
        <text x="90" y="103" textAnchor="middle" fontSize="10.5" fill="var(--muted-foreground)">
          {centro}
        </text>
      </svg>

      {/* Una sola columna, siempre al lado del donut (debajo solo en móvil).
          Las filas se aprietan cuando hay muchas categorías para que la
          leyenda no doble la altura del donut. */}
      <div
        className={cn(
          'flex w-full min-w-0 flex-col sm:w-auto sm:max-w-90 sm:flex-1',
          positivas.length > 8 ? 'gap-1' : 'gap-2',
        )}>
        {partes.map((p) => (
          <div
            key={p.label}
            className={cn('flex items-center gap-2', positivas.length > 8 ? 'text-[12.5px]' : 'text-[13px]')}>
            <span className="inline-block size-2.5 shrink-0 rounded-xs" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground" title={p.label}>{p.label}</span>
            <span className="shrink-0 pl-3 font-semibold tabular-nums">
              {eurCorto(Math.max(0, p.valor))}
              <span className="ml-1.5 font-normal text-muted-foreground">
                {total > 0 ? `${Math.round((Math.max(0, p.valor) / total) * 100)} %` : ''}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Línea de ahorro acumulado por años (suma corrida del ahorro anual).
export function AcumuladoChart({ puntos }: { puntos: Array<{ year: number; valor: number }> }) {
  const [ref, ancho] = useAncho()
  // Con pocos años no tiene sentido ocupar todo el ancho: una línea de mil
  // píxeles entre dos puntos se ve vacía. El lienzo crece ~200px por tramo
  // hasta el hueco disponible, y el dibujo queda centrado en la tarjeta.
  const ideal = 88 + 200 * Math.max(1, puntos.length - 1)
  const W = Math.min(ancho || 760, ideal)
  const H = Math.min(240, Math.max(190, Math.round(W * 0.22)))
  const padL = 64
  const padB = 26
  const padT = 16
  const innerW = W - padL - 24
  const innerH = H - padT - padB

  const values = puntos.map((p) => p.valor)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  const x = (i: number) => padL + (puntos.length > 1 ? (innerW / (puntos.length - 1)) * i : innerW / 2)
  const y = (v: number) => padT + innerH - ((v - min) / range) * innerH

  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const area = `${x(0)},${y(min)} ${points} ${x(values.length - 1)},${y(min)}`

  return (
    <div ref={ref} className="w-full" style={{ minHeight: H }}>
      {ancho > 0 && (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto block h-auto w-full"
      style={{ maxHeight: H }}
      role="img"
      aria-label="Ahorro acumulado por año">
      {[0.5, 1].map((g) => (
        <line
          key={g}
          x1={padL} y1={y(min + range * g)} x2={W - 24} y2={y(min + range * g)}
          stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      <line x1={padL} y1={y(min)} x2={W - 24} y2={y(min)} stroke="var(--border)" strokeWidth="1" />

      <polygon points={area} fill="var(--primary)" opacity="0.12" />
      <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {puntos.map((p, i) => (
        <g key={p.year}>
          <title>{`${p.year}: ${eurCorto(p.valor)}`}</title>
          <circle cx={x(i)} cy={y(p.valor)} r="4" fill="var(--card)" stroke="var(--primary)" strokeWidth="2.5" />
          <text x={x(i)} y={y(p.valor) - 10} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--muted-foreground)">
            {eurCorto(p.valor)}
          </text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--muted-foreground)">
            {p.year}
          </text>
        </g>
      ))}
    </svg>
      )}
    </div>
  )
}
