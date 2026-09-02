'use client'

// Sesiones activas del dashboard (registro user_session): quién está dentro,
// desde qué dispositivo y desde cuándo, con cierre remoto — al borrar la fila,
// el callback jwt corta esa sesión en su siguiente petición.
import { useTransition } from 'react'
import Image from 'next/image'
import { LogOut, MonitorSmartphone, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useConfirmar } from '@/components/dashboard/confirmar'
import { btnOutline } from '@/components/ui/botones'
import { closeAllSessions, closeSession } from '@/app/app/panel/actions'
import { Celda, Fila, FilaVacia, Tabla, TarjetaTabla, type Columna } from '@/components/ui/tabla'

const COLUMNAS: Columna[] = [
  { label: 'Usuario' },
  { label: 'Dispositivo' },
  { label: 'Inicio' },
  { label: 'Última actividad' },
  { label: 'Acciones', alineado: 'derecha', oculta: true },
]

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

export function SessionsList({
  rows,
  ahora,
  politica,
}: {
  rows: SessionRow[]
  ahora: string
  /** Política de caducidad vigente, en texto (la calcula el servidor). */
  politica: string
}) {
  const confirmar = useConfirmar()
  const [pending, startTransition] = useTransition()

  const cerrar = (uuid: string) =>
    startTransition(async () => {
      const res = await closeSession(uuid)
      if (!res.ok) toast.error(res.message ?? 'Error')
      else toast.success('Sesión cerrada: ese dispositivo queda fuera')
    })

  const cerrarTodas = () =>
    startTransition(async () => {
      const res = await closeAllSessions()
      if (!res.ok) {
        toast.error(res.message ?? 'Error')
        return
      }
      const n = 'cerradas' in res ? (res.cerradas ?? 0) : 0
      toast.success(
        n === 0
          ? 'No había otras sesiones abiertas'
          : `${n} ${n === 1 ? 'sesión' : 'sesiones'} cerradas: solo queda esta`,
      )
    })

  // La propia no cuenta: no se puede cerrar desde aquí (ver la action).
  const otras = rows.filter((s) => !s.esActual).length

  return (
    <TarjetaTabla
      titulo="Sesiones activas"
      icono={<MonitorSmartphone className="size-4.5 text-primary" />}
      cuenta={rows.length}
      // La política, a la vista: sin esto "sesiones activas" no dice cuánto
      // duran, y los dos plazos se configuran por entorno.
      nota={politica}
      acciones={
        // El botón de pánico (un portátil perdido, un navegador ajeno). Solo
        // aparece si hay algo que cerrar: con una sola sesión —la tuya— no
        // haría nada y sería un botón para equivocarse.
        otras > 0 ? (
          <button
            type="button"
            className={btnOutline}
            disabled={pending}
            onClick={async () => {
              if (
                await confirmar({
                  clave: 'cerrar-todas-las-sesiones',
                  titulo: 'Cerrar todas las sesiones',
                  texto: `${otras} ${otras === 1 ? 'dispositivo' : 'dispositivos'} tendrá que volver a entrar. La tuya se queda abierta.`,
                  etiqueta: 'Cerrar todas',
                })
              ) {
                cerrarTodas()
              }
            }}>
            <LogOut className="size-4" />
            Cerrar todas
          </button>
        ) : undefined
      }>
      <Tabla columnas={COLUMNAS} minAncho="min-w-160">
        {rows.length === 0 ? (
          <FilaVacia columnas={COLUMNAS.length}>No hay sesiones registradas</FilaVacia>
        ) : (
          rows.map((s) => (
            <Fila key={s.uuid} destacada={s.esActual}>
              <Celda>
                <span className="flex items-center gap-2">
                  {s.userPicture ? (
                    <Image src={s.userPicture} alt="" width={24} height={24} className="rounded-full" />
                  ) : (
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserRound className="size-3.5" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{s.userName ?? s.userEmail}</span>
                    {s.userName && (
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {s.userEmail}
                      </span>
                    )}
                  </span>
                </span>
              </Celda>
              <Celda className="text-muted-foreground">{s.dispositivo}</Celda>
              <Celda className="text-muted-foreground">{fmtEdad(s.inicioTs, ahora)}</Celda>
              <Celda className="text-muted-foreground">{fmtEdad(s.lastSeenTs, ahora)}</Celda>
              <Celda alineado="derecha">
                {s.esActual ? (
                  <span className="rounded-md bg-success-bg px-2 py-0.5 text-xs font-semibold text-success">
                    Esta sesión
                  </span>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      'rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors max-sm:px-3 max-sm:py-2.5',
                      'hover:border-danger/50 hover:bg-danger-bg hover:text-danger disabled:opacity-50',
                    )}
                    disabled={pending}
                    onClick={async () => {
                      if (
                        await confirmar({
                          clave: 'cerrar-sesion-remota',
                          titulo: 'Cerrar la sesión',
                          texto: `${s.userName ?? s.userEmail} (${s.dispositivo}) tendrá que volver a entrar.`,
                          etiqueta: 'Cerrar sesión',
                        })
                      ) {
                        cerrar(s.uuid)
                      }
                    }}>
                    Cerrar sesión
                  </button>
                )}
              </Celda>
            </Fila>
          ))
        )}
      </Tabla>
    </TarjetaTabla>
  )
}
