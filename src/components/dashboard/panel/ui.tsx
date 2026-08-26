'use client'

// Piezas compartidas por las pestañas del Panel de control: tarjeta de
// comprobación (con barra de uso opcional), botón de refresco y formateadores.
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EstadoCheck } from '@/lib/infra'

export const ESTADO_TAG: Record<EstadoCheck, { className: string; label: string }> = {
  ok: { className: 'bg-success-bg text-success', label: 'Correcto' },
  aviso: { className: 'bg-warning-bg text-warning', label: 'Aviso' },
  error: { className: 'bg-danger-bg text-danger', label: 'Error' },
}

const BARRA: Record<EstadoCheck, string> = {
  ok: 'bg-success',
  aviso: 'bg-warning',
  error: 'bg-danger',
}

// "3 d 4 h", "5 h 12 min", "8 min" — suficiente para leer un uptime de un vistazo.
export const fmtDuracion = (seg: number) => {
  const min = Math.floor(seg / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h ${min % 60} min`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}

export const fmtFecha = (iso: string, conHora = false) =>
  new Date(iso).toLocaleString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  })

// Edad relativa medida contra la instantánea (no contra el reloj del cliente:
// así servidor y cliente renderizan lo mismo y no hay avisos de hidratación).
export const fmtEdad = (desdeIso: string, hastaIso: string) => {
  const min = Math.max(0, Math.floor((new Date(hastaIso).getTime() - new Date(desdeIso).getTime()) / 60_000))
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} días`
}

export const fmtBytes = (b: number) => {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toLocaleString('es-ES', { maximumFractionDigits: 1 })} GB`
  if (b >= 1_048_576) return `${(b / 1_048_576).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`
  return `${Math.max(1, Math.round(b / 1024))} KB`
}

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Madrid',
  })

export function CheckCard({
  icon, title, estado, value, lines, barPct,
}: {
  icon: React.ReactNode
  title: string
  estado?: EstadoCheck
  value: string
  lines: string[]
  barPct?: number
}) {
  const tag = estado && ESTADO_TAG[estado]
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-sm font-semibold">
          <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary">
            {icon}
          </span>
          {title}
        </span>
        {tag && (
          <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', tag.className)}>
            {tag.label}
          </span>
        )}
      </div>
      <p className="mt-3.5 text-2xl font-semibold">{value}</p>
      {barPct !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full', estado ? BARRA[estado] : 'bg-primary')}
            style={{ width: `${Math.min(100, Math.max(0, barPct))}%` }}
          />
        </div>
      )}
      <div className="mt-1.5 flex flex-col gap-0.5">
        {lines.map((l) => (
          <p key={l} className="text-[13px] text-muted-foreground">{l}</p>
        ))}
      </div>
    </div>
  )
}

// Barra superior común: hora de la instantánea + refresco del server component
// (router.refresh vuelve a ejecutar las comprobaciones de la pestaña activa).
// `children` se pinta a la izquierda (controles extra de la pestaña).
export function Refrescar({ generadoEn, children }: { generadoEn: string; children?: React.ReactNode }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      {children}
      <span className="flex-1" />
      <span className="text-xs text-muted-foreground">
        Comprobado a las {fmtHora(generadoEn)}
      </span>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}>
        <RefreshCw className={cn('size-4', pending && 'animate-spin')} />
        Comprobar de nuevo
      </button>
    </div>
  )
}
