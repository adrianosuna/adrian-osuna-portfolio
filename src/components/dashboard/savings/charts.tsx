'use client'

// Gráficas SVG del sistema de ahorro (sin librerías de charts, para no engordar
// el bundle): barras mensuales apiladas y línea de capital acumulado por años.
// Los colores salen de los tokens del tema (funcionan en claro y oscuro).
import type { MonthRow, YearSummary } from '@/lib/finance'

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const eurCorto = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €'

// Barras apiladas por mes: ahorro general + ahorro para viajes.
export function MonthlyChart({ months }: { months: MonthRow[] }) {
  const W = 760
  const H = 220
  const padL = 56
  const padB = 26
  const padT = 14
  const innerW = W - padL - 12
  const innerH = H - padT - padB

  const totalDe = (m: MonthRow) => (m.savingGeneral || 0) + (m.savingTravel || 0)
  const max = Math.max(...months.map(totalDe), 1)
  // Techo "redondo" para que las líneas de guía caigan en cifras legibles.
  const step = Math.pow(10, Math.max(1, String(Math.ceil(max)).length - 1))
  const top = Math.ceil(max / step) * step

  const bw = (innerW / 12) * 0.52
  const x = (i: number) => padL + (innerW / 12) * i + (innerW / 12 - bw) / 2
  const y = (v: number) => padT + innerH - (v / top) * innerH

  const guides = [0.25, 0.5, 0.75, 1]

  return (
    // min-w en móvil: por debajo de ~560px el SVG escala hasta textos ilegibles;
    // mejor que scrollee dentro de su contenedor (overflow-x-auto).
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-140 sm:min-w-0" role="img" aria-label="Ahorro por mes">
      {guides.map((g) => (
        <g key={g}>
          <line
            x1={padL} y1={y(top * g)} x2={W - 12} y2={y(top * g)}
            stroke="var(--border)" strokeWidth="1" strokeDasharray={g === 1 ? '' : '3 4'} />
          <text x={padL - 8} y={y(top * g) + 4} textAnchor="end" fontSize="10.5" fill="var(--muted-foreground)">
            {eurCorto(top * g)}
          </text>
        </g>
      ))}
      <line x1={padL} y1={y(0)} x2={W - 12} y2={y(0)} stroke="var(--border)" strokeWidth="1" />

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
            <text x={x(i) + bw / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--muted-foreground)">
              {MESES_CORTOS[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Línea de capital acumulado por años (capital final = inicial + ahorro general).
export function CapitalChart({ years, capitalFinalDe }: { years: YearSummary[]; capitalFinalDe: (y: YearSummary) => number }) {
  const W = 760
  const H = 190
  const padL = 64
  const padB = 26
  const padT = 16
  const innerW = W - padL - 24
  const innerH = H - padT - padB

  const values = years.map(capitalFinalDe)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  const x = (i: number) => padL + (years.length > 1 ? (innerW / (years.length - 1)) * i : innerW / 2)
  const y = (v: number) => padT + innerH - ((v - min) / range) * innerH

  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const area = `${x(0)},${y(min)} ${points} ${x(values.length - 1)},${y(min)}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-140 sm:min-w-0" role="img" aria-label="Capital acumulado por año">
      {[0.5, 1].map((g) => (
        <line
          key={g}
          x1={padL} y1={y(min + range * g)} x2={W - 24} y2={y(min + range * g)}
          stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      <line x1={padL} y1={y(min)} x2={W - 24} y2={y(min)} stroke="var(--border)" strokeWidth="1" />

      <polygon points={area} fill="var(--primary)" opacity="0.12" />
      <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {values.map((v, i) => (
        <g key={years[i].year}>
          <title>{`${years[i].year}: ${eurCorto(v)}`}</title>
          <circle cx={x(i)} cy={y(v)} r="4" fill="var(--card)" stroke="var(--primary)" strokeWidth="2.5" />
          <text x={x(i)} y={y(v) - 10} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--muted-foreground)">
            {eurCorto(v)}
          </text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--muted-foreground)">
            {years[i].year}
          </text>
        </g>
      ))}
    </svg>
  )
}
