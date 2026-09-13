'use client'

// Búsqueda de movimientos en todo el histórico por concepto, tipo, fechas e importe.
// Solo consulta: cada fila lleva a su mes. Los filtros viajan por query param.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { useCarga } from '@/components/dashboard/barra-carga'
import { cn } from '@/lib/utils'
import { TarjetaCifra } from '@/components/dashboard/tarjeta-cifra'
import { Tooltip } from '@/components/ui/tooltip'
import { DateField, Field, NumberField, SelectField, TextField } from '@/components/ui/fields'
import type { CategoriaRow, FiltrosBusqueda, ResultadoBusqueda } from '@/lib/gastos'
import { etiquetaCategoria } from '@/lib/categorias'
import { btnOutline, btnPrimary, cardClass, eur, eurEntero, SIN_CATEGORIA } from './comun'

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' (la búsqueda cruza años: el año siempre importa). */
const fmtFecha = (iso: string) => iso.split('-').reverse().join('/')

export function BuscarGastos({
  filtros, resultado, categorias, tieneFiltros,
}: {
  /** Filtros ya aplicados (para rellenar el formulario al recargar). */
  filtros: FiltrosBusqueda
  resultado: ResultadoBusqueda
  categorias: CategoriaRow[]
  /** ¿Se ha buscado algo? (si no, se muestra solo el formulario). */
  tieneFiltros: boolean
}) {
  const router = useRouter()
  const iniciar = useCarga()

  const [q, setQ] = useState(filtros.q ?? '')
  const [tipo, setTipo] = useState<string>(filtros.tipo ?? '')
  const [desde, setDesde] = useState(filtros.desde ?? '')
  const [hasta, setHasta] = useState(filtros.hasta ?? '')
  const [min, setMin] = useState<number | null>(filtros.min ?? null)
  const [max, setMax] = useState<number | null>(filtros.max ?? null)

  const catDe = (uuid: string | null) => categorias.find((c) => c.uuid === uuid)
  const balance = resultado.ingresos - resultado.gastos

  const ir = (url: string) => {
    iniciar()
    router.push(url)
  }

  /** Los filtros actuales como query string (sin la página). */
  const paramsDeFiltros = () => {
    const p = new URLSearchParams({ s: 'gastos', buscar: '1' })
    if (q.trim()) p.set('q', q.trim())
    if (tipo) p.set('tipo', tipo)
    if (desde) p.set('desde', desde)
    if (hasta) p.set('hasta', hasta)
    if (min != null) p.set('min', String(min))
    if (max != null) p.set('max', String(max))
    return p
  }

  // Paginar conserva los filtros ya aplicados (los del servidor), no los del
  // formulario: lo escrito sin pulsar Buscar no debe aplicarse a medias.
  const irAPagina = (n: number) => {
    const p = new URLSearchParams({ s: 'gastos', buscar: '1' })
    if (filtros.q?.trim()) p.set('q', filtros.q.trim())
    if (filtros.tipo) p.set('tipo', filtros.tipo)
    if (filtros.desde) p.set('desde', filtros.desde)
    if (filtros.hasta) p.set('hasta', filtros.hasta)
    if (filtros.min != null) p.set('min', String(filtros.min))
    if (filtros.max != null) p.set('max', String(filtros.max))
    if (n > 1) p.set('p', String(n))
    ir(`/app/finance?${p.toString()}`)
  }

  const buscar = () => {
    ir(`/app/finance?${paramsDeFiltros().toString()}`)
  }

  const limpiar = () => {
    setQ(''); setTipo(''); setDesde(''); setHasta(''); setMin(null); setMax(null)
    ir('/app/finance?s=gastos&buscar=1')
  }

  return (
    <div>
      {/* Cabecera: volver a la vista del mes */}
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          className={cn(btnOutline, 'px-2.5')}
          aria-label="Volver a Gastos"
          onClick={() => ir('/app/finance?s=gastos')}>
          <ArrowLeft className="size-4" />
          <span className="max-sm:sr-only">Gastos</span>
        </button>
        <h2 className="flex items-center gap-2 font-semibold">
          <Search className="size-4 text-primary" />
          Buscar movimientos
        </h2>
      </div>

      {/* Formulario de filtros */}
      <div className={cn(cardClass, 'p-4')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <Field label="Concepto">
              <TextField
                value={q}
                onChange={setQ}
                placeholder="Buscar…"
                onEnter={buscar}
                ariaLabel="Concepto a buscar"
              />
            </Field>
          </div>
          <Field label="Tipo">
            <SelectField
              value={tipo}
              onChange={setTipo}
              ariaLabel="Tipo de movimiento"
              options={[
                { value: '', label: 'Todos' },
                { value: 'GASTO', label: 'Gastos' },
                { value: 'INGRESO', label: 'Ingresos' },
              ]}
            />
          </Field>
          <Field label="Desde">
            <DateField value={desde} onChange={setDesde} ariaLabel="Fecha desde" placeholder="Sin límite" />
          </Field>
          <Field label="Hasta">
            <DateField value={hasta} onChange={setHasta} ariaLabel="Fecha hasta" placeholder="Sin límite" />
          </Field>
          <Field label="Importe mínimo">
            <NumberField value={min} onChange={setMin} step={5} ariaLabel="Importe mínimo" placeholder="Sin mínimo" />
          </Field>
          <Field label="Importe máximo">
            <NumberField value={max} onChange={setMax} step={5} ariaLabel="Importe máximo" placeholder="Sin máximo" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btnOutline} onClick={limpiar}>
            Limpiar
          </button>
          <button type="button" className={btnPrimary} onClick={buscar}>
            <Search className="size-4" />
            Buscar
          </button>
        </div>
      </div>

      {/* Resultado */}
      {!tieneFiltros ? (
        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          Rellena algún filtro y pulsa Buscar. Se busca en todo el histórico, no solo en el mes.
        </p>
      ) : resultado.total === 0 ? (
        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          Ningún movimiento coincide con esos filtros.
        </p>
      ) : (
        <>
          {/* Sumas del conjunto de coincidencias */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TarjetaCifra label="Coincidencias" valor={String(resultado.total)} />
            <TarjetaCifra label="Ingresos" valor={eurEntero(resultado.ingresos)} tono="success" icono={<TrendingUp className="size-4" />} />
            <TarjetaCifra label="Gastos" valor={eurEntero(resultado.gastos)} tono="danger" icono={<TrendingDown className="size-4" />} />
            <TarjetaCifra label="Balance" valor={eurEntero(balance)} tono={balance >= 0 ? 'primary' : 'danger'} />
          </div>

          <div className={cn(cardClass, 'mt-4')}>
            <h2 className="flex flex-wrap items-baseline gap-x-2 border-b border-border px-5 py-3 font-semibold">
              {`${resultado.total} ${resultado.total === 1 ? 'movimiento' : 'movimientos'}`}
              {resultado.paginas > 1 && (
                <span className="text-[12.5px] font-normal text-muted-foreground">
                  página {resultado.pagina} de {resultado.paginas}
                </span>
              )}
            </h2>
            <div className="px-4 py-2">
              {resultado.movimientos.map((m) => {
                const cat = catDe(m.categoryUuid)
                const esGasto = m.type === 'GASTO'
                return (
                  <button
                    key={m.uuid}
                    type="button"
                    // Cada fila lleva a su mes, donde se edita (aquí es consulta).
                    className="flex w-full items-center gap-2 border-b border-white/8 py-2 text-left transition-colors last:border-0 hover:bg-white/6"
                    onClick={() => ir(`/app/finance?s=gastos&mes=${m.expenseDate.slice(0, 7)}`)}>
                    <span className="w-20 shrink-0 text-[12px] tabular-nums text-muted-foreground">
                      {fmtFecha(m.expenseDate)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{m.concept}</span>
                    <Tooltip texto={`${esGasto ? 'Gasto' : 'Ingreso'} · ${cat ? etiquetaCategoria(cat) : 'Sin categoría'}`}>
                      <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground sm:w-56">
                        <span
                          className="inline-block size-2 shrink-0 rounded-xs"
                          style={{ background: cat?.color ?? SIN_CATEGORIA }}
                        />
                        {/* Con su grupo delante, como en la tabla del mes. */}
                        <span className="hidden min-w-0 truncate sm:block">
                          {cat ? etiquetaCategoria(cat) : 'Sin categoría'}
                        </span>
                      </span>
                    </Tooltip>
                    <span
                      className={cn(
                        'shrink-0 text-[13.5px] font-semibold tabular-nums sm:w-24 sm:text-right',
                        esGasto ? 'text-danger' : 'text-success',
                      )}>
                      {esGasto ? '−' : '+'}
                      {eur(m.amount)}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Paginador. Solo con más de una página: con 12 resultados, unos
                controles de página son ruido. */}
            {resultado.paginas > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <button
                  type="button"
                  className={btnOutline}
                  disabled={resultado.pagina <= 1}
                  onClick={() => irAPagina(resultado.pagina - 1)}>
                  <ChevronLeft className="size-4" />
                  Anterior
                </button>
                <span className="text-[12.5px] text-muted-foreground">
                  {resultado.pagina} / {resultado.paginas}
                </span>
                <button
                  type="button"
                  className={btnOutline}
                  disabled={resultado.pagina >= resultado.paginas}
                  onClick={() => irAPagina(resultado.pagina + 1)}>
                  Siguiente
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

