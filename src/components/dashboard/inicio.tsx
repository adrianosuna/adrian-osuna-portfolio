// Piezas visuales del inicio del dashboard: tarjeta de KPI, franja de avisos
// ("requiere tu atención") y lista de actividad reciente. Sin estado: los
// datos los prepara lib/inicio.ts y los pasa la página.
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock, Mail, Phone, StickyNote, Users,
} from 'lucide-react'
import type { ActividadItem, Aviso } from '@/lib/inicio'
import { cn } from '@/lib/utils'

export const cardClass = 'rounded-xl border border-border bg-card'

/** Antigüedad en lenguaje corto ("hace 2 h", "ayer", "hace 3 días"). */
export function hace(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const horas = Math.round(min / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  return dias === 1 ? 'ayer' : `hace ${dias} días`
}

/** Tarjeta de KPI: etiqueta, cifra grande y un pie con contexto. */
export function Tile({
  label, valor, pie, icon, chip, to,
}: {
  label: string
  valor: React.ReactNode
  pie?: React.ReactNode
  icon: React.ReactNode
  chip: string
  to?: string
}) {
  const cuerpo = (
    <div className={cn(cardClass, 'h-full p-4', to && 'transition-colors hover:border-primary/40')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] text-muted-foreground">{label}</p>
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-md', chip)}>{icon}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{valor}</p>
      {pie && <div className="mt-1.5 text-[12px] text-muted-foreground">{pie}</div>}
    </div>
  )
  return to ? <Link href={to}>{cuerpo}</Link> : cuerpo
}

export function TileEsqueleto() {
  return (
    <div className={cn(cardClass, 'h-full p-4')}>
      <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-2.5 h-7 w-16 animate-pulse rounded bg-muted" />
      <div className="mt-2.5 h-3 w-28 animate-pulse rounded bg-muted" />
    </div>
  )
}

/** Franja de avisos accionables; sin avisos, el estado "todo al día". */
export function Atencion({ avisos }: { avisos: Aviso[] }) {
  if (!avisos.length) {
    return (
      <div className={cn(cardClass, 'flex items-center gap-3 p-4')}>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success-bg text-success">
          <CheckCircle2 className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Todo al día</p>
          <p className="text-[12.5px] text-muted-foreground">
            Sin seguimientos vencidos, mantenimiento al día y el ahorro cuadrado.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(cardClass, 'overflow-hidden')}>
      {avisos.map((a, i) => (
        <Link
          key={a.clave}
          href={a.href}
          className={cn(
            'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
            i > 0 && 'border-t border-border/60',
          )}>
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-lg',
              a.gravedad === 'urgente' ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning',
            )}>
            {a.gravedad === 'urgente' ? <AlertTriangle className="size-4.5" /> : <Clock className="size-4.5" />}
          </span>
          {/* En móvil el hueco es de ~250px y el aviso se cortaba en su propio
              título ("2 seguimientos del pipeline venci…"), que es justo lo
              primero que hay que leer: ahí se reparte en dos líneas. */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold max-sm:line-clamp-2 sm:truncate">{a.texto}</p>
            {a.detalle && (
              <p className="text-[12.5px] text-muted-foreground max-sm:line-clamp-2 sm:truncate">{a.detalle}</p>
            )}
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  )
}

const ICONO_ACTIVIDAD: Record<string, typeof Mail> = {
  ESTADO: ArrowRight, NOTA: StickyNote, LLAMADA: Phone, EMAIL: Mail, REUNION: Users,
}

/** Últimos movimientos del pipeline (historial de las oportunidades). */
export function Actividad({ items }: { items: ActividadItem[] }) {
  return (
    <div className={cn(cardClass, 'px-4 py-3')}>
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <h2 className="text-[15px] font-semibold">Actividad reciente</h2>
        <Link href="/app/pipeline" className="text-[12.5px] font-semibold text-primary hover:underline">
          Oportunidades
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Sin movimientos todavía. Al trabajar el pipeline, aquí queda el rastro.
        </p>
      ) : (
        items.map((it, i) => {
          const Icono = ICONO_ACTIVIDAD[it.tipo] ?? StickyNote
          return (
            <div
              key={it.uuid}
              className={cn('flex items-start gap-2.5 py-2.5', i < items.length - 1 && 'border-b border-border/60')}>
              <Icono
                className={cn(
                  'mt-0.5 size-3.5 shrink-0',
                  it.tipo === 'ESTADO' ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] leading-snug">{it.detalle}</p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {it.oportunidad} · {hace(it.cuando)}
                </p>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
