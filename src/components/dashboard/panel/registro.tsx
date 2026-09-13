'use client'

// Pestaña "Registro": los warn y error guardados en BD, con filtros por nivel, scope,
// texto y días, y paginación en el servidor. Los filtros viven en la URL.
import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ChevronDown, ChevronRight, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { chipFiltro } from '@/components/ui/botones'
import { SelectField, TextField } from '@/components/ui/fields'
import { useCarga } from '@/components/dashboard/barra-carga'
import { DIAS, MESES } from '@/lib/fechas'
import type { LogPagina } from '@/lib/log-db'

/** Ventanas de tiempo que se ofrecen. `0` = todo lo retenido. */
const VENTANAS = [
  { dias: 1, label: 'Hoy' },
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
  { dias: 0, label: 'Todo' },
] as const

const ESTILO = {
  error: {
    chip: 'bg-danger-bg text-danger', Icono: XCircle,
    nombre: 'Error', plural: 'Errores', tinte: 'text-danger',
  },
  warn: {
    chip: 'bg-warning-bg text-warning', Icono: AlertTriangle,
    nombre: 'Aviso', plural: 'Avisos', tinte: 'text-warning',
  },
} as const

/** "Lunes, 7 de septiembre · 15:42:03" — con segundos: dos errores del mismo
 *  minuto son lo normal cuando algo falla en bucle, y el orden importa. */
function fechaHora(iso: string) {
  const d = new Date(iso)
  const dia = DIAS[d.getDay()]
  const hora = d.toLocaleTimeString('es-ES', { hour12: false })
  return `${dia}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} · ${hora}`
}

/** Hora sola, para la columna compacta de la fila. */
const soloHora = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour12: false })

export function Registro({
  datos, filtros, porPagina, retencion,
}: {
  datos: LogPagina
  filtros: { nivel?: 'warn' | 'error'; scope?: string; q?: string; dias: number; pagina: number }
  porPagina: number
  /** Días de retención, para decir de qué periodo se está hablando. */
  retencion: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const iniciar = useCarga()
  const [, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState(filtros.q ?? '')
  const [abierto, setAbierto] = useState<string | null>(null)

  /** Navega cambiando solo lo que se toca, y siempre volviendo a la página 1. */
  const ir = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString())
    p.set('tab', 'registro')
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null || v === '') p.delete(k)
      else p.set(k, v)
    }
    if (!('p' in cambios)) p.delete('p')
    iniciar()
    startTransition(() => router.push(`/app/panel?${p.toString()}`))
  }

  const paginas = Math.max(1, Math.ceil(datos.total / porPagina))
  const hayFiltro = Boolean(filtros.nivel || filtros.scope || filtros.q)

  return (
    <div className="flex flex-col gap-3">
      {/* Cabecera: las cuentas por nivel hacen de filtro, que es como se usa
          esto de verdad ("¿hay errores?" → clic). */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex superficie-baja rounded-xl p-0.5" role="group" aria-label="Filtrar por nivel">
          <button
            type="button"
            aria-pressed={!filtros.nivel}
            className={cn(chipFiltro, !filtros.nivel ? 'bg-white/8 text-foreground' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => ir({ nivel: null })}>
            Todo <span className="tabular-nums">{datos.porNivel.error + datos.porNivel.warn}</span>
          </button>
          {(['error', 'warn'] as const).map((n) => {
            // El icono se saca a una variable: `<ESTILO[n].Icono />` no es JSX
            // válido (no se puede indexar en el nombre de la etiqueta).
            const { Icono, plural, tinte } = ESTILO[n]
            return (
              <button
                key={n}
                type="button"
                aria-pressed={filtros.nivel === n}
                className={cn(
                  chipFiltro,
                  'inline-flex items-center gap-1.5',
                  filtros.nivel === n ? 'bg-white/8 text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => ir({ nivel: n })}>
                <Icono className={cn('size-3.5', tinte)} aria-hidden />
                {plural} <span className="tabular-nums">{datos.porNivel[n]}</span>
              </button>
            )
          })}
        </div>

        <div className="flex superficie-baja rounded-xl p-0.5" role="group" aria-label="Ventana de tiempo">
          {VENTANAS.map((v) => (
            <button
              key={v.dias}
              type="button"
              aria-pressed={filtros.dias === v.dias}
              className={cn(chipFiltro, filtros.dias === v.dias ? 'bg-white/8 text-foreground' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => ir({ dias: v.dias === 30 ? null : String(v.dias) })}>
              {v.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 max-sm:w-full">
          <TextField
            className="w-full sm:w-56"
            ariaLabel="Buscar en el registro"
            placeholder="Buscar..."
            value={busqueda}
            onChange={setBusqueda}
            onEnter={() => ir({ q: busqueda.trim() || null })}
          />
          {/* Los scopes que hay, no una lista fija. Con `SelectField` y no un <select>
              nativo: el dashboard tiene su propio desplegable. */}
          {datos.scopes.length > 1 && (
            <SelectField
              className="w-40 shrink-0"
              ariaLabel="Filtrar por módulo"
              value={filtros.scope ?? ''}
              onChange={(v) => ir({ scope: v || null })}
              options={[
                { value: '', label: 'Todos los módulos' },
                ...datos.scopes.map((s) => ({ value: s, label: s })),
              ]}
            />
          )}
        </div>
      </div>

      {datos.filas.length === 0 ? (
        <div className="superficie rounded-2xl p-6 text-center text-sm text-muted-foreground">
          {hayFiltro ? (
            <>
              Ningún evento con estos filtros.{' '}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => { setBusqueda(''); ir({ nivel: null, scope: null, q: null }) }}>
                Quitarlos
              </button>
            </>
          ) : (
            // El vacío bueno: que no haya nada que registrar es la situación
            // normal, así que no puede leerse como un error de la pantalla.
            <>
              Sin avisos ni errores{filtros.dias > 0 ? ` en los últimos ${filtros.dias === 1 ? 'días' : `${filtros.dias} días`}` : ''}.
              Es la buena noticia: aquí solo se guarda lo que va mal.
            </>
          )}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 superficie rounded-2xl">
          {datos.filas.map((f) => {
            const { chip, Icono, nombre } = ESTILO[f.level === 'warn' ? 'warn' : 'error']
            const desplegado = abierto === f.uuid
            return (
              <li key={f.uuid}>
                <button
                  type="button"
                  aria-expanded={desplegado}
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-white/6"
                  onClick={() => setAbierto(desplegado ? null : f.uuid)}>
                  {desplegado ? (
                    <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className={cn('mt-0.5 shrink-0 rounded-md p-1', chip)}>
                    <Icono className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13.5px] font-semibold">{f.message}</span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {f.scope}
                      </span>
                    </span>
                    <Tooltip texto={`${nombre} · ${fechaHora(f.createTs)}`}>
                      <span className="mt-0.5 block text-[12px] tabular-nums text-muted-foreground">
                        {soloHora(f.createTs)} · {new Date(f.createTs).toLocaleDateString('es-ES')}
                      </span>
                    </Tooltip>
                  </span>
                </button>
                {desplegado && (
                  // Los datos en crudo, con la traza. `pre` con scroll propio para que una traza
                  // larga no ensanche la página.
                  <div className="px-4 pb-3 pl-11">
                    {f.datos ? (
                      <pre className="max-h-72 overflow-auto rounded-lg bg-background p-3 text-[11.5px] leading-relaxed text-muted-foreground">
                        {JSON.stringify(f.datos, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">
                        El evento no traía datos: solo el mensaje.
                      </p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
        <p>
          {datos.total === 0
            ? 'Sin eventos'
            : `${datos.total} ${datos.total === 1 ? 'evento' : 'eventos'}`}
          {paginas > 1 && ` · página ${filtros.pagina} de ${paginas}`}
          {retencion > 0 && ` · se guardan ${retencion} días`}
        </p>
        {paginas > 1 && (
          <span className="flex gap-1">
            <button
              type="button"
              disabled={filtros.pagina <= 1}
              className={cn(chipFiltro, 'border border-border disabled:opacity-40')}
              onClick={() => ir({ p: String(filtros.pagina - 1) })}>
              Anterior
            </button>
            <button
              type="button"
              disabled={filtros.pagina >= paginas}
              className={cn(chipFiltro, 'border border-border disabled:opacity-40')}
              onClick={() => ir({ p: String(filtros.pagina + 1) })}>
              Siguiente
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
