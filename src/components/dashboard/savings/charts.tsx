'use client'

// Gráficas SVG del sistema de ahorro (sin librerías de charts, para no engordar
// el bundle): barras mensuales apiladas y línea de ahorro acumulado por años.
// Los colores salen de los tokens del tema (funcionan en claro y oscuro).
import type { MonthRow } from '@/lib/finance'

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// useGrouping siempre: es-ES no agrupa los números de 4 cifras por defecto.
const eurCorto = (v: number) =>
  v.toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' }) + ' €'

// Barras apiladas por mes: ahorro general + ahorro para viajes. La variante
// `compacto` cabe en una pantalla de móvil sin scroll: lienzo estrecho,
// meses a una letra, eje abreviado (1,2k) y menos guías.
export function MonthlyChart({ months, compacto = false }: { months: MonthRow[]; compacto?: boolean }) {
  const W = compacto ? 360 : 760
  const H = compacto ? 185 : 220
  const padL = compacto ? 36 : 56
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
    // min-w en móvil (solo la variante grande): por debajo de ~560px el SVG
    // escala hasta textos ilegibles; mejor que scrollee en su contenedor.
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={compacto ? 'block h-auto w-full' : 'block h-auto w-full min-w-140 sm:min-w-0'}
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
  )
}

// Donut con la composición del ahorro anual: qué peso tienen el ahorro
// mensual, los ingresos extraordinarios y el sobrante de viajes. Cada parte
// se pinta como arco de circunferencia (dasharray sobre un círculo girado).
export function DonutAhorro({ partes }: {
  partes: Array<{ label: string; valor: number; color: string }>
}) {
  const positivas = partes.filter((p) => p.valor > 0)
  const total = positivas.reduce((s, p) => s + p.valor, 0)
  if (total <= 0) {
    return <p className="py-6 text-center text-[13px] text-muted-foreground">Sin datos de ahorro todavía.</p>
  }

  const R = 62
  const C = 2 * Math.PI * R
  const HUECO = 0.012 // separación entre arcos (fracción de la circunferencia)
  const arcos = positivas.reduce<Array<{ p: (typeof positivas)[number]; desde: number; frac: number }>>(
    (acc, p) => {
      const desde = acc.length ? acc[acc.length - 1].desde + acc[acc.length - 1].frac : 0
      return [...acc, { p, desde, frac: p.valor / total }]
    },
    [],
  )

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
      <svg viewBox="0 0 180 180" className="size-44" role="img" aria-label="Composición del ahorro anual">
        {arcos.map(({ p, desde, frac }) => (
          <circle
            key={p.label}
            cx="90" cy="90" r={R}
            fill="none"
            stroke={p.color}
            strokeWidth="26"
            strokeDasharray={`${Math.max(0, (frac - (positivas.length > 1 ? HUECO : 0)) * C)} ${C}`}
            strokeDashoffset={-desde * C}
            transform="rotate(-90 90 90)">
            <title>{`${p.label}: ${eurCorto(p.valor)} (${Math.round(frac * 100)}%)`}</title>
          </circle>
        ))}
        <text x="90" y="86" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--foreground)">
          {eurCorto(total)}
        </text>
        <text x="90" y="103" textAnchor="middle" fontSize="10.5" fill="var(--muted-foreground)">
          ahorro anual
        </text>
      </svg>

      <div className="flex flex-col gap-2">
        {partes.map((p) => (
          <div key={p.label} className="flex items-center gap-2 text-[13px]">
            <span className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="ml-auto pl-4 font-semibold">
              {eurCorto(Math.max(0, p.valor))}
              <span className="ml-1.5 font-normal text-muted-foreground">
                {total > 0 ? `${Math.round((Math.max(0, p.valor) / total) * 100)}%` : ''}
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
  const W = 760
  const H = 190
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
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-140 sm:min-w-0" role="img" aria-label="Ahorro acumulado por año">
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
  )
}
