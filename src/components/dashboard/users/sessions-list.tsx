'use client'

// Sesiones activas del dashboard (registro user_session): quién está dentro,
// desde qué dispositivo y desde cuándo, con cierre remoto — al borrar la fila,
// el callback jwt corta esa sesión en su siguiente petición.
import { useState, useTransition } from 'react'
import Image from 'next/image'
import { MonitorSmartphone, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { closeSession } from '@/app/app/panel/actions'

export interface SessionRow {
  uuid: string
  userName: string | null
  userEmail: string
  userPicture: string | null
  dispositivo: string // "Chrome · Windows" (user-agent resumido)
  inicioTs: string // ISO (login)
  lastSeenTs: string // ISO (última petición registrada)
  esActual: boolean
}

// Edad relativa contra la instantánea del servidor (sin desajustes de hidratación).
const fmtEdad = (desdeIso: string, hastaIso: string) => {
  const min = Math.max(0, Math.floor((new Date(hastaIso).getTime() - new Date(desdeIso).getTime()) / 60_000))
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} días`
}

export function SessionsList({ rows, ahora }: { rows: SessionRow[]; ahora: string }) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const cerrar = (uuid: string) =>
    startTransition(async () => {
      setConfirming(null)
      const res = await closeSession(uuid)
      if (!res.ok) toast.error(res.message ?? 'Error')
      else toast.success('Sesión cerrada: ese dispositivo queda fuera')
    })

  return (
    <div>
      <h2 className="mb-3 mt-8 flex items-center gap-2 text-[15px] font-semibold">
        <MonitorSmartphone className="size-4.5 text-primary" />
        Sesiones activas
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {rows.length}
        </span>
      </h2>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground/70">
          No hay sesiones registradas
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-card">
          {rows.map((s) => (
            <div key={s.uuid} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              {s.userPicture ? (
                <Image src={s.userPicture} alt="" width={32} height={32} className="rounded-full" />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.userName ?? s.userEmail}</p>
                <p className="text-[12.5px] text-muted-foreground">
                  {s.dispositivo} · inicio {fmtEdad(s.inicioTs, ahora)} · actividad{' '}
                  {fmtEdad(s.lastSeenTs, ahora)}
                </p>
              </div>
              {s.esActual ? (
                <span className="rounded-md bg-success-bg px-2 py-0.5 text-xs font-semibold text-success">
                  Esta sesión
                </span>
              ) : confirming === s.uuid ? (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-md bg-danger px-2.5 py-1 text-xs font-semibold text-white"
                    disabled={pending}
                    onClick={() => cerrar(s.uuid)}>
                    Cerrar
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Cancelar"
                    onClick={() => setConfirming(null)}>
                    <X className="size-3.5" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className={cn(
                    'rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors',
                    'hover:border-danger/50 hover:bg-danger-bg hover:text-danger disabled:opacity-50',
                  )}
                  disabled={pending}
                  onClick={() => setConfirming(s.uuid)}>
                  Cerrar sesión
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
