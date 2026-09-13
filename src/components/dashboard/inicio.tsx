// Piezas visuales del inicio: tarjeta KPI, franja de avisos y actividad reciente.
// Sin estado: los datos los prepara lib/inicio.ts.
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock, Mail, Phone, StickyNote, Users,
} from 'lucide-react'
import type { ActividadItem, Aviso } from '@/lib/inicio'
import { cn } from '@/lib/utils'
import { tarjeta } from '@/components/ui/superficie'
// La tarjeta de cifra es compartida; se re-exporta con los nombres que ya usaba el inicio.
export { TarjetaCifra as Tile, TarjetaCifraEsqueleto as TileEsqueleto } from '@/components/dashboard/tarjeta-cifra'

export const cardClass = tarjeta

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
            'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/4',
            i > 0 && 'border-t border-white/8',
          )}>
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-lg',
              a.gravedad === 'urgente' ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning',
            )}>
            {a.gravedad === 'urgente' ? <AlertTriangle className="size-4.5" /> : <Clock className="size-4.5" />}
          </span>
          {/* En móvil el aviso se cortaba en su propio título: ahí va en dos líneas. */}
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
    <div className={cn('@container', cardClass, 'px-4 py-3')}>
      <div className="flex items-center justify-between border-b border-white/8 pb-2.5">
        <h2 className="text-[15px] font-semibold">Actividad reciente</h2>
        {/* `py-1`: sin él la caja pulsable mide 19 px de alto, por debajo de
            los 24 que pide WCAG 2.2 AA (2.5.8). */}
        <Link href="/app/pipeline" className="py-1 text-[12.5px] font-semibold text-primary hover:underline">
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
              className={cn('flex items-start gap-2.5 py-2.5', i < items.length - 1 && 'border-b border-white/8')}>
              <Icono
                className={cn(
                  'mt-0.5 size-3.5 shrink-0',
                  it.tipo === 'ESTADO' ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              {/* En una tarjeta ancha, el origen y el cuándo se van al otro extremo
                  de la fila en vez de quedar debajo del texto. */}
              <div className="min-w-0 flex-1 @3xl:flex @3xl:items-baseline @3xl:justify-between @3xl:gap-6">
                <p className="truncate text-[13px] leading-snug">{it.detalle}</p>
                <p className="truncate text-[11.5px] text-muted-foreground @3xl:shrink-0">
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
