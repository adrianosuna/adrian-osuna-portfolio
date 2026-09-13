// Esqueletos de carga del dashboard, comunes. Todos con `aria-hidden`: son un hueco
// visual, no información.

/** Rejilla de tarjetas: el hueco de una pestaña del Panel o de Ajustes. */
export function EsqueletoTarjetas({ n = 6, conBoton = true }: { n?: number; conBoton?: boolean }) {
  return (
    <div aria-hidden="true">
      {conBoton && (
        <div className="mb-3 flex justify-end">
          <div className="h-8 w-44 animate-pulse rounded-md bg-muted" />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="h-32 animate-pulse superficie rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

/** Fila de KPIs + un bloque grande: la forma de casi todas las vistas de datos. */
export function EsqueletoPanel({ kpis = 4 }: { kpis?: number }) {
  return (
    <div aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: kpis }, (_, i) => (
          <div key={i} className="h-24 animate-pulse superficie rounded-2xl" />
        ))}
      </div>
      <div className="mt-4 h-72 animate-pulse superficie rounded-2xl" />
    </div>
  )
}

/** Lista o tabla: cabecera y filas. */
export function EsqueletoLista({ filas = 8 }: { filas?: number }) {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-xl border border-border">
      <div className="h-10 animate-pulse bg-white/6" />
      <div className="divide-y divide-border/60">
        {Array.from({ length: filas }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Kanban: métricas y cinco columnas. Las columnas se ocultan bajo `md`, donde el
 *  tablero no existe. */
export function EsqueletoTablero() {
  return (
    <div aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse superficie rounded-2xl" />
        ))}
      </div>
      <div className="mt-4 hidden gap-3 md:grid md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-80 animate-pulse superficie rounded-2xl" />
        ))}
      </div>
      <div className="mt-4 md:hidden">
        <EsqueletoLista filas={5} />
      </div>
    </div>
  )
}
