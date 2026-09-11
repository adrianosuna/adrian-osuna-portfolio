'use client'

// Mapa de visitas sobre un mundo en SVG: países en burbuja (área proporcional) y
// ciudades con pin. Sin dependencias ni red: ruta incrustada y tabla local de coordenadas.
import { useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import { cn, cuenta } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { proyectar, puntoDeCiudad, puntoDePais } from '@/lib/geo-visitas'
import { MUNDO_PATH } from './mundo-path'

const ANCHO = 1000
const ALTO = 500

interface Fila {
  etiqueta: string
  valor: number
}

interface Marca {
  etiqueta: string
  valor: number
  x: number
  y: number
  r: number
}

/** Radio por ÁREA proporcional al valor, entre un mínimo legible y un máximo. */
const radio = (valor: number, max: number, minR: number, maxR: number) =>
  minR + (maxR - minR) * Math.sqrt(Math.max(0, valor) / Math.max(1, max))

function marcas(filas: Fila[], punto: (n: string) => { lat: number; lon: number } | null, minR: number, maxR: number) {
  const max = Math.max(...filas.map((f) => f.valor), 1)
  const dentro: Marca[] = []
  const fuera: Fila[] = []
  for (const f of filas) {
    const p = punto(f.etiqueta)
    if (!p) {
      fuera.push(f)
      continue
    }
    const { x, y } = proyectar(p, ANCHO, ALTO)
    dentro.push({ etiqueta: f.etiqueta, valor: f.valor, x, y, r: radio(f.valor, max, minR, maxR) })
  }
  // De mayor a menor para pintar las grandes debajo: si no, una burbuja grande
  // tapa a la pequeña que cae dentro.
  return { dentro: dentro.sort((a, b) => b.valor - a.valor), fuera }
}

/** Encuadre: la caja de las marcas con margen, o el mundo entero. Sin esto el mapa
 *  es casi todo océano. Proporción 2:1 y ancho mínimo para un solo punto. */
const MIN_ANCHO = 220
function encuadre(ms: Marca[], todoElMundo: boolean) {
  if (todoElMundo || ms.length === 0) return { x: 0, y: 0, w: ANCHO, h: ALTO }
  const margen = 40
  let x0 = Math.min(...ms.map((m) => m.x - m.r)) - margen
  const x1 = Math.max(...ms.map((m) => m.x + m.r)) + margen
  let y0 = Math.min(...ms.map((m) => m.y - m.r)) - margen
  const y1 = Math.max(...ms.map((m) => m.y + m.r)) + margen
  // Ancho mínimo y proporción del lienzo, creciendo desde el centro.
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const w = Math.min(ANCHO, Math.max(MIN_ANCHO, x1 - x0, ((y1 - y0) * ANCHO) / ALTO))
  const h = (w * ALTO) / ANCHO
  x0 = cx - w / 2
  y0 = cy - h / 2
  // Y dentro del lienzo: si se sale por un lado, se empuja al borde.
  x0 = Math.min(Math.max(0, x0), ANCHO - w)
  y0 = Math.min(Math.max(0, y0), ALTO - h)
  return { x: x0, y: y0, w, h }
}

export function MapaVisitas({ paises, ciudades }: { paises: Fila[]; ciudades: Fila[] }) {
  const [capa, setCapa] = useState<'ambas' | 'paises' | 'ciudades'>('ambas')
  const [todoElMundo, setTodoElMundo] = useState(false)
  const p = useMemo(() => marcas(paises, puntoDePais, 6, 26), [paises])
  const c = useMemo(() => marcas(ciudades, puntoDeCiudad, 3, 9), [ciudades])

  const verPaises = capa !== 'ciudades'
  const verCiudades = capa !== 'paises'
  const sinUbicar = [...(verPaises ? p.fuera : []), ...(verCiudades ? c.fuera : [])]
  const visibles = [...(verPaises ? p.dentro : []), ...(verCiudades ? c.dentro : [])]
  const nada = visibles.length === 0
  const caja = encuadre(visibles, todoElMundo)
  // El viewBox escala todo, radios y grosores incluidos: se compensan por el factor
  // para que un pin mida lo mismo encuadrado en España o en el planeta.
  const k = caja.w / ANCHO

  return (
    <div className="flex flex-col gap-3">
      {/* Capas: con pocos datos las dos juntas se leen bien, pero con muchas
          ciudades sobre un país las burbujas se pisan y conviene separarlas. */}
      <div className="flex rounded-lg border border-border bg-card/50 p-0.5" role="group" aria-label="Capas del mapa">
        {(
          [
            { id: 'ambas', label: 'Todo' },
            { id: 'paises', label: `Países (${p.dentro.length})` },
            { id: 'ciudades', label: `Ciudades (${c.dentro.length})` },
          ] as const
        ).map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={capa === o.id}
            className={cn(
              // py-2.5 en móvil: ~44px de alto, el objetivo táctil que usa el
              // resto del proyecto (el segmentado del alta, los filtros).
              'flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors max-sm:py-2.5',
              capa === o.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setCapa(o.id)}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Si todo el tráfico es de un país el encuadre pierde la referencia: este botón
          devuelve el planeta. */}
      <button
        type="button"
        aria-pressed={todoElMundo}
        // `py-2` no cambia cómo se ve el texto, solo la zona pulsable: sin
        // ella eran 18px de alto, la mitad de lo que necesita un pulgar.
        className="self-start py-2 text-[12px] font-semibold text-primary hover:underline"
        onClick={() => setTodoElMundo((v) => !v)}>
        {todoElMundo ? 'Ajustar a las visitas' : 'Ver todo el mundo'}
      </button>

      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <svg
          viewBox={`${caja.x} ${caja.y} ${caja.w} ${caja.h}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Mapa con ${cuenta(p.dentro.length, 'país', 'países')} y ${cuenta(c.dentro.length, 'ciudad', 'ciudades')} marcadas`}>
          {/* La tierra, apagada: es el contexto, no el dato. */}
          <path d={MUNDO_PATH} fillRule="evenodd" className="fill-muted" />

          {verPaises &&
            p.dentro.map((m) => (
              <circle
                key={`p-${m.etiqueta}`}
                cx={m.x}
                cy={m.y}
                r={m.r * k}
                className="fill-primary/35 stroke-primary"
                strokeWidth={1.5 * k}
              />
            ))}

          {verCiudades &&
            c.dentro.map((m) => (
              <circle
                key={`c-${m.etiqueta}`}
                cx={m.x}
                cy={m.y}
                r={m.r * k}
                className="fill-viajes stroke-background"
                strokeWidth={1.2 * k}
              />
            ))}
        </svg>
      </div>

      {/* Las marcas del SVG no son texto legible: la lista de al lado es la que se
          lee, ordena y anuncia (misma razón que la leyenda de los donuts). */}
      {nada ? (
        <p className="py-2 text-center text-[13px] text-muted-foreground">
          No hay ninguna ubicación que situar en el mapa con este rango.
        </p>
      ) : (
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {verPaises &&
            p.dentro.map((m) => (
              <Leyenda key={`lp-${m.etiqueta}`} color="bg-primary/60" etiqueta={m.etiqueta} valor={m.valor} />
            ))}
          {verCiudades &&
            c.dentro.map((m) => (
              <Leyenda key={`lc-${m.etiqueta}`} icono etiqueta={m.etiqueta} valor={m.valor} />
            ))}
        </div>
      )}

      {sinUbicar.length > 0 && (
        // Honestidad sobre la tabla: lo que no tiene coordenadas se dice, con
        // su nombre, en vez de desaparecer del recuento sin más.
        <p className="text-[12px] leading-snug text-muted-foreground">
          Sin situar en el mapa:{' '}
          {sinUbicar.map((f) => `${f.etiqueta} (${f.valor})`).join(', ')}. Siguen contando en los
          rankings de la tarjeta.
        </p>
      )}
    </div>
  )
}

function Leyenda({ etiqueta, valor, color, icono }: {
  etiqueta: string
  valor: number
  color?: string
  icono?: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-[12.5px]">
      {icono ? (
        <MapPin className="size-3 shrink-0 text-viajes" aria-hidden />
      ) : (
        <span className={cn('inline-block size-2.5 shrink-0 rounded-full', color)} aria-hidden />
      )}
      <Tooltip texto={etiqueta}>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{etiqueta}</span>
      </Tooltip>
      <span className="shrink-0 font-semibold tabular-nums">{valor.toLocaleString('es-ES')}</span>
    </div>
  )
}
