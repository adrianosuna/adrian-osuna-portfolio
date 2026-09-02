'use client'

// Centro de notificaciones de la barra superior: los mismos avisos accionables
// que la franja "Requiere tu atención" del inicio (seguimientos vencidos,
// mantenimiento, meses de ahorro sin rellenar), pero visibles desde CUALQUIER
// página del dashboard.
//
// Por qué existe: el cron ya avisa por correo, pero el correo se lee fuera de
// la app y a las 8:00; si entras a media tarde no hay nada que te lo recuerde.
// Los avisos se calculan en el servidor (`avisosPendientes`) y llegan como
// prop: no hay tabla de notificaciones porque no hay nada que guardar — un
// aviso es una CONSULTA sobre el estado actual, no un registro. Si la tarea se
// hace, el aviso desaparece solo.
//
// Lo "leído" sí es del dispositivo (localStorage): se recuerda la HUELLA del
// aviso (clave + texto), así que si el aviso cambia —de 2 seguimientos a 3—
// vuelve a contar como nuevo, que es lo que uno querría.
import { useState } from 'react'
import Link from 'next/link'
import { Bell, Check, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Aviso } from '@/lib/inicio'
import { usePreferencia } from '@/lib/preferencias'

const CLAVE_VISTOS = 'avisos-vistos'

/** Huella de un aviso: si cambia su texto, vuelve a ser nuevo. */
const huella = (a: Aviso) => `${a.clave}|${a.texto}`

export function Notificaciones({ avisos }: { avisos: Aviso[] }) {
  const [abierto, setAbierto] = useState(false)
  const [vistos, setVistos] = usePreferencia<string[]>(CLAVE_VISTOS, [])

  const sinVer = avisos.filter((a) => !vistos.includes(huella(a)))
  const urgentes = sinVer.some((a) => a.gravedad === 'urgente')

  const marcarTodos = () => setVistos(avisos.map(huella))

  return (
    // `max-sm:static`: en móvil el contenedor DEJA de ser el bloque de
    // referencia, así que el panel se posiciona respecto a la barra superior
    // (que es sticky) y puede ocupar el ancho de la pantalla. Anclado a la
    // campana se salía 117px por la izquierda: la campana no está en el borde
    // derecho —detrás van buscar, "+" y la hamburguesa— y un panel de 320px
    // colgado de ella no cabe en 375.
    <div className="relative max-sm:static">
      <button
        type="button"
        className={cn(
          // p-2.5 en móvil (40px): el mismo objetivo táctil que `btnIcon`.
          'relative rounded-md p-2 transition-colors hover:bg-muted max-sm:p-2.5',
          sinVer.length ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label={
          sinVer.length
            ? `Avisos: ${sinVer.length} sin ver`
            : avisos.length
              ? 'Avisos (todos vistos)'
              : 'Sin avisos'
        }
        aria-expanded={abierto}
        aria-haspopup="menu"
        onClick={() => setAbierto((o) => !o)}>
        <Bell className="size-5 max-md:size-5 md:size-4" />
        {sinVer.length > 0 && (
          // El punto va con cifra: "hay algo" y "cuánto" en el mismo píxel.
          <span
            className={cn(
              // Texto OSCURO sobre el rojo/ámbar: el blanco se queda en 2,77:1 y AA
              // pide 4,5. Mismo motivo por el que `--primary-foreground` es oscuro.
              'absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[11px] font-bold leading-4 text-background',
              urgentes ? 'bg-danger' : 'bg-warning',
            )}>
            {sinVer.length}
          </span>
        )}
      </button>

      {abierto && (
        <>
          {/* Capa de cierre: un clic fuera cierra el panel (sin listener global). */}
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-lg max-sm:left-4 max-sm:right-4 max-sm:w-auto">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
              <p className="text-sm font-semibold">Avisos</p>
              {avisos.length > 0 && sinVer.length > 0 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary transition-opacity hover:opacity-80"
                  onClick={marcarTodos}>
                  <Check className="size-3.5" />
                  Marcar como vistos
                </button>
              )}
            </div>

            {avisos.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-[13px] text-muted-foreground">
                Nada pendiente. Cuando venza un seguimiento o una tarea de mantenimiento, saldrá
                aquí.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {avisos.map((a) => {
                  const nuevo = !vistos.includes(huella(a))
                  return (
                    <Link
                      key={a.clave}
                      href={a.href}
                      onClick={() => {
                        // Abrirlo lo marca visto: ya lo has atendido (o al menos
                        // lo has mirado), y seguir contándolo sería ruido.
                        if (nuevo) setVistos([...vistos, huella(a)])
                        setAbierto(false)
                      }}
                      className="flex items-start gap-2.5 border-b border-border/60 px-3.5 py-2.5 transition-colors last:border-0 hover:bg-muted/60">
                      <span
                        className={cn(
                          'mt-0.5 shrink-0',
                          a.gravedad === 'urgente' ? 'text-danger' : 'text-warning',
                        )}>
                        <TriangleAlert className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold leading-snug">
                          {a.texto}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                          {a.detalle}
                        </span>
                      </span>
                      {nuevo && (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-label="Sin ver" />
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
