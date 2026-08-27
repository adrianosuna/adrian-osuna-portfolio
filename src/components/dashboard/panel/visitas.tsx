'use client'

// Pestaña "Visitas" del Panel de control: métricas de GA4 de los últimos 30
// días (Data API con service account) con comparativa frente a los 30 previos,
// conversiones de la landing (eventos clic_*), geografía, tecnología y mapa
// horario. Gráficas SVG a mano, como las del módulo de ahorro.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3, ExternalLink, Eye, MousePointerClick, Radio, Target, TriangleAlert,
  UserPlus, Users, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Fila, Metrica, RangoDias, VisitasSnapshot } from '@/lib/ga'
import { leerUsuariosAhora } from '@/app/app/panel/actions'
import { Refrescar } from './ui'

const RANGOS: RangoDias[] = [7, 30, 90]

// Agrupación de miles siempre (es-ES no agrupa los números de 4 cifras).
const nf = (v: number) => v.toLocaleString('es-ES', { useGrouping: 'always' })

// "1 min 32 s" / "45 s" para la duración media de sesión.
const fmtSeg = (seg: number) => {
  const s = Math.round(seg)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
}

// "25 ago" para las etiquetas del eje X.
const fmtDia = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

// Flecha de tendencia frente al periodo previo del mismo tamaño.
function Tendencia({ m, dias }: { m: Metrica; dias: number }) {
  if (m.actual === 0 && m.previo === 0) return null
  if (m.previo === 0) return <span className="text-[11.5px] font-semibold text-success">Nuevo · sin periodo previo</span>
  const pct = Math.round(((m.actual - m.previo) / m.previo) * 100)
  if (pct === 0) return <span className="text-[11.5px] text-muted-foreground/70">= vs. {dias} días previos</span>
  return (
    <span className={cn('text-[11.5px] font-semibold', pct > 0 ? 'text-success' : 'text-danger')}>
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct)} % vs. {dias} días previos
    </span>
  )
}

// Selector de rango (7/30/90 días): navega con la URL, como las pestañas.
function SelectorRango({ dias }: { dias: RangoDias }) {
  return (
    <span className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
      {RANGOS.map((r) => (
        <Link
          key={r}
          href={`/app/panel?tab=visitas&dias=${r}`}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
            dias === r ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
          )}>
          {r} días
        </Link>
      ))}
    </span>
  )
}

function Kpi({
  icon, label, value, hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold leading-tight">{value}</p>
        {hint && <p className="leading-tight">{hint}</p>}
      </div>
    </div>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <h2 className="mb-3 text-[15px] font-semibold">{titulo}</h2>
      {children}
    </div>
  )
}

// Barras diarias de usuarios activos. `paso`: cada cuántos días va etiqueta.
// `compacto`: viewBox estrecho para móvil — a escala ~1:1 el texto se lee bien,
// sin scroll horizontal ni letras microscópicas.
function SerieChart({
  serie, paso, compacto = false,
}: {
  serie: VisitasSnapshot['serie']
  paso: number
  compacto?: boolean
}) {
  const W = compacto ? 360 : 760
  const H = compacto ? 170 : 200
  const padL = compacto ? 28 : 34
  const padB = 24
  const padT = 12
  const innerW = W - padL - 12
  const innerH = H - padT - padB
  // En compacto caben ~5 etiquetas de fecha como mucho.
  const pasoReal = compacto ? Math.max(paso, Math.ceil(serie.length / 5)) : paso

  const max = Math.max(...serie.map((d) => d.activos), 1)
  const top = Math.max(Math.ceil(max * 1.15), 4)

  const n = serie.length
  const bw = (innerW / n) * 0.62
  const slot = innerW / n
  const x = (i: number) => padL + slot * i + (slot - bw) / 2
  const y = (v: number) => padT + innerH - (v / top) * innerH

  // Tooltip propio: <title> de SVG solo funciona con ratón y tras un retardo.
  // Ratón: hover (pointerenter/leave). Táctil: tocar fija el día, retocar
  // el mismo lo quita. La columna entera es zona de impacto, no solo la barra.
  const [sel, setSel] = useState<number | null>(null)
  const dia = sel === null ? null : serie[sel]

  return (
    <div
      className="relative"
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setSel(null)
      }}>
      {dia && sel !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-center shadow-lg"
          style={{ left: `${Math.min(86, Math.max(14, ((x(sel) + bw / 2) / W) * 100))}%` }}>
          <p className="text-[11px] font-semibold text-muted-foreground">{fmtDia(dia.fecha)}</p>
          <p className="text-xs font-semibold">
            {nf(dia.activos)} {dia.activos === 1 ? 'usuario' : 'usuarios'} · {nf(dia.vistas)} {dia.vistas === 1 ? 'vista' : 'vistas'}
          </p>
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Usuarios activos por día">
        {[0.5, 1].map((g) => (
          <g key={g}>
            <line
              x1={padL} y1={y(top * g)} x2={W - 12} y2={y(top * g)}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
            <text x={padL - 8} y={y(top * g) + 4} textAnchor="end" fontSize="10.5" fill="var(--muted-foreground)">
              {Math.round(top * g)}
            </text>
          </g>
        ))}
        <line x1={padL} y1={y(0)} x2={W - 12} y2={y(0)} stroke="var(--border)" strokeWidth="1" />

        {serie.map((d, i) => (
          <g key={d.fecha}>
            {/* Guía del día seleccionado */}
            {sel === i && (
              <line
                x1={x(i) + bw / 2} y1={padT} x2={x(i) + bw / 2} y2={y(0)}
                stroke="var(--primary)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            )}
            {d.activos > 0 && (
              <rect
                x={x(i)} y={y(d.activos)} width={bw} height={y(0) - y(d.activos)} rx="2"
                fill="var(--primary)" opacity={sel === null || sel === i ? 1 : 0.45} />
            )}
            {(i % pasoReal === 0 || i === n - 1) && (
              <text x={x(i) + bw / 2} y={H - 7} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                {fmtDia(d.fecha)}
              </text>
            )}
            {/* Zona de impacto de la columna completa (invisible) */}
            <rect
              x={padL + slot * i} y={padT} width={slot} height={innerH}
              fill="transparent"
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') setSel(i)
              }}
              onPointerDown={(e) => {
                if (e.pointerType !== 'mouse') setSel(sel === i ? null : i)
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}

// Lista con barra proporcional (rankings).
function Ranking({ filas, vacio }: { filas: Fila[]; vacio?: string }) {
  const max = Math.max(...filas.map((f) => f.valor), 1)
  if (!filas.length) {
    return (
      <p className="py-4 text-center text-[13px] text-muted-foreground/60">
        {vacio ?? 'Sin datos en el rango elegido'}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2.5">
      {filas.map((f) => (
        <div key={f.etiqueta}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate font-mono text-[12.5px]">{f.etiqueta}</span>
            <span className="shrink-0 text-[12.5px] font-semibold">{nf(f.valor)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${(f.valor / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Subtítulo para tarjetas con dos rankings (Geografía, Tecnología).
function Subtitulo({ children, primero }: { children: React.ReactNode; primero?: boolean }) {
  return (
    <h3 className={cn('mb-2 text-[11.5px] font-semibold uppercase tracking-[0.6px] text-muted-foreground/70', !primero && 'mt-5')}>
      {children}
    </h3>
  )
}

// Rejilla día × hora con intensidad de color según usuarios activos.
// Escritorio: días como filas y 24 horas en horizontal. Móvil: transpuesta
// (horas en vertical, 7 columnas de días) — cabe sin scroll ni celdas mínimas.
const DIAS_MAPA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const colorCelda = (v: number, max: number) =>
  v === 0
    ? 'var(--muted)'
    : `color-mix(in oklab, var(--primary) ${Math.round(20 + (v / max) * 80)}%, var(--muted))`

const tituloCelda = (d: number, h: number, v: number) =>
  `${DIAS_MAPA[d]} ${String(h).padStart(2, '0')}:00 — ${v} ${v === 1 ? 'usuario' : 'usuarios'}`

function MapaHorario({ horario }: { horario: number[][] }) {
  const max = Math.max(...horario.flat(), 1)
  return (
    <>
      {/* Escritorio: 7 filas × 24 horas */}
      <div className="hidden grid-cols-[auto_repeat(24,1fr)] gap-1 sm:grid">
        {horario.map((fila, d) => (
          <div key={DIAS_MAPA[d]} className="contents">
            <span className="pr-1.5 text-right font-mono text-[10.5px] leading-5 text-muted-foreground">
              {DIAS_MAPA[d]}
            </span>
            {fila.map((v, h) => (
              <div
                key={h}
                title={tituloCelda(d, h, v)}
                className="h-5 rounded-[4px]"
                style={{ background: colorCelda(v, max) }}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center font-mono text-[9.5px] text-muted-foreground/70">
            {h % 4 === 0 ? h : ''}
          </span>
        ))}
      </div>

      {/* Móvil: transpuesta — 24 filas de horas × 7 columnas de días */}
      <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-1 sm:hidden">
        <span />
        {DIAS_MAPA.map((dia) => (
          <span key={dia} className="text-center font-mono text-[10.5px] text-muted-foreground">
            {dia}
          </span>
        ))}
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="contents">
            <span className="pr-1.5 text-right font-mono text-[9.5px] leading-3.5 text-muted-foreground/70">
              {h % 4 === 0 ? `${h}h` : ''}
            </span>
            {horario.map((fila, d) => (
              <div
                key={d}
                title={tituloCelda(d, h, fila[h])}
                className="h-3.5 rounded-[3px]"
                style={{ background: colorCelda(fila[h], max) }}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

export function VisitasTab({ snapshot }: { snapshot: VisitasSnapshot }) {
  const { totales, dias, nuevos } = snapshot

  // "Ahora mismo" vivo: se refresca solo cada 45 s (solo el dato de tiempo
  // real, sin re-ejecutar el resto de informes) y se pausa en pestañas ocultas.
  const [ahora, setAhora] = useState(snapshot.ahora)
  // Resincroniza con cada instantánea nueva (patrón valor-previo en render).
  const [prevGen, setPrevGen] = useState(snapshot.generadoEn)
  if (prevGen !== snapshot.generadoEn) {
    setPrevGen(snapshot.generadoEn)
    setAhora(snapshot.ahora)
  }
  useEffect(() => {
    if (!snapshot.configurado || snapshot.error) return
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const v = await leerUsuariosAhora()
      if (v !== null) setAhora(v)
    }, 45_000)
    return () => clearInterval(id)
  }, [snapshot.configurado, snapshot.error])

  // Tasa de conversión: clics instrumentados frente a usuarios del rango.
  const clics = snapshot.conversiones.reduce((acc, c) => acc + c.valor, 0)
  const usuarios = totales.activos.actual
  const totalNuevos = nuevos.nuevos + nuevos.recurrentes

  if (!snapshot.configurado) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2.5 text-[15px] font-semibold">
          <span className="grid size-8 place-items-center rounded-[10px] bg-warning-bg text-warning">
            <BarChart3 className="size-4" />
          </span>
          Visitas sin configurar
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Esta pestaña lee Google Analytics con la Data API y necesita tres variables de
          entorno: <code className="text-foreground">GA_PROPERTY_ID</code>,{' '}
          <code className="text-foreground">GA_SA_CLIENT_EMAIL</code> y{' '}
          <code className="text-foreground">GA_SA_PRIVATE_KEY</code> (una service account de
          Google Cloud con acceso de Lector a la propiedad GA4). El procedimiento completo
          está en <code className="text-foreground">docs/DESPLIEGUE.md</code>.
        </p>
      </div>
    )
  }

  if (snapshot.error) {
    return (
      <div>
        <Refrescar generadoEn={snapshot.generadoEn} />
        <div className="rounded-xl border border-danger/40 bg-danger-bg p-6">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-danger">
            <TriangleAlert className="size-4.5" />
            No se pudieron leer las visitas
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {snapshot.error}. Revisa que la service account tenga acceso de Lector a la
            propiedad, que la Data API esté habilitada en el proyecto de Google Cloud y que
            el <code>GA_PROPERTY_ID</code> sea el id numérico (no el G-XXXX).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Refrescar generadoEn={snapshot.generadoEn}>
        <SelectorRango dias={dias} />
        <a
          href={`https://analytics.google.com/analytics/web/#/p${snapshot.propertyId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary">
          Abrir en Google Analytics <ExternalLink className="size-3" />
        </a>
      </Refrescar>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Radio className="size-5" />}
          label="Ahora mismo"
          value={ahora === null ? '—' : nf(ahora)}
          hint={<span className="text-[11.5px] text-muted-foreground/70">Tiempo real · se actualiza solo</span>}
        />
        <Kpi
          icon={<Users className="size-5" />}
          label={`Usuarios (${dias} días)`}
          value={nf(totales.activos.actual)}
          hint={<Tendencia m={totales.activos} dias={dias} />}
        />
        <Kpi
          icon={<MousePointerClick className="size-5" />}
          label={`Sesiones (${dias} días)`}
          value={nf(totales.sesiones.actual)}
          hint={<Tendencia m={totales.sesiones} dias={dias} />}
        />
        <Kpi
          icon={<Eye className="size-5" />}
          label={`Vistas de página (${dias} días)`}
          value={nf(totales.vistas.actual)}
          hint={<Tendencia m={totales.vistas} dias={dias} />}
        />
        <Kpi
          icon={<BarChart3 className="size-5" />}
          label="Duración media de sesión"
          value={fmtSeg(totales.duracionSeg.actual)}
          hint={<Tendencia m={totales.duracionSeg} dias={dias} />}
        />
        <Kpi
          icon={<Target className="size-5" />}
          label="Tasa de interacción"
          value={`${Math.round(totales.interaccionPct.actual)} %`}
          hint={<Tendencia m={totales.interaccionPct} dias={dias} />}
        />
        <Kpi
          icon={<Zap className="size-5" />}
          label="Tasa de conversión"
          value={usuarios > 0 && clics > 0 ? `${Math.round((clics / usuarios) * 100)} %` : '—'}
          hint={
            <span className="text-[11.5px] text-muted-foreground/70">
              {clics > 0 ? `${nf(clics)} clics / ${nf(usuarios)} usuarios` : 'Sin clics de conversión aún'}
            </span>
          }
        />
        <Kpi
          icon={<UserPlus className="size-5" />}
          label="Visitantes nuevos"
          value={totalNuevos > 0 ? `${Math.round((nuevos.nuevos / totalNuevos) * 100)} %` : '—'}
          hint={
            <span className="text-[11.5px] text-muted-foreground/70">
              {totalNuevos > 0
                ? `${nf(nuevos.nuevos)} nuevos · ${nf(nuevos.recurrentes)} recurrentes`
                : 'Sin datos en el rango'}
            </span>
          }
        />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card px-5 py-4">
        <h2 className="mb-3 text-[15px] font-semibold">Usuarios activos por día</h2>
        {/* Dos variantes del SVG: compacta en móvil, ancha en pantalla grande */}
        <div className="sm:hidden">
          <SerieChart serie={snapshot.serie} paso={dias <= 7 ? 1 : dias <= 30 ? 5 : 15} compacto />
        </div>
        <div className="hidden sm:block">
          <SerieChart serie={snapshot.serie} paso={dias <= 7 ? 1 : dias <= 30 ? 5 : 15} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Conversiones de la landing">
          <Ranking
            filas={snapshot.conversiones}
            vacio="Sin clics registrados aún — los eventos clic_* empiezan a contar desde su instrumentación"
          />
        </Tarjeta>
        <Tarjeta titulo="Fuentes de tráfico">
          <Ranking filas={snapshot.fuentes} />
        </Tarjeta>
        <Tarjeta titulo="Páginas más vistas">
          <Ranking filas={snapshot.paginas} />
        </Tarjeta>
        <Tarjeta titulo="Canales de adquisición">
          <Ranking filas={snapshot.canales} />
        </Tarjeta>
        <Tarjeta titulo="Geografía">
          <Subtitulo primero>Países</Subtitulo>
          <Ranking filas={snapshot.paises} />
          <Subtitulo>Ciudades</Subtitulo>
          <Ranking filas={snapshot.ciudades} />
        </Tarjeta>
        <Tarjeta titulo="Tecnología">
          <Subtitulo primero>Dispositivos</Subtitulo>
          <Ranking filas={snapshot.dispositivos} />
          <Subtitulo>Navegadores</Subtitulo>
          <Ranking filas={snapshot.navegadores} />
        </Tarjeta>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card px-5 py-4">
        <h2 className="mb-3 text-[15px] font-semibold">Cuándo te visitan (día × hora)</h2>
        <MapaHorario horario={snapshot.horario} />
      </div>
    </div>
  )
}
