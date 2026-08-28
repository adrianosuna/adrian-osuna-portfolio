'use client'

// Sección "Ajustes" de Finanzas (`?s=ajustes`): TODA la configuración del
// módulo, un bloque por cosa — CATEGORÍAS (con su tope), RECURRENTES y AÑOS de
// ahorro.
//
// Antes cada una vivía en un modal dentro de su vista, con scroll y sin sitio:
// con 19 categorías había que buscar a ojo. Ahora las LISTAS son una sección de
// verdad (buscador, filtros, fusión, usos) y lo que sí va en modal son los
// FORMULARIOS —alta y edición, los mismos campos— porque son cinco o seis
// campos que en una fila no se leen.
import { useState, useTransition } from 'react'
import {
  CalendarRange, Check, ChevronDown, Copy, FileDown, Merge, Pause, Pencil, PlayCircle, Plus,
  Repeat, Tag, Trash2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { DateField, NumberField, SelectField, TextField } from '@/components/ui/fields'
import type { CategoriaRow, TipoMovimiento } from '@/lib/gastos'
import type { YearSummary } from '@/lib/finance'
import { createYear, deleteYear, updateYear } from '@/app/app/finance/actions'
import {
  apuntarRecurrenteAhora, createCategoria, createRecurrente, deleteCategoria, deleteRecurrente,
  fusionarCategorias, leerMovimientosDeRecurrente, updateCategoria, updateRecurrente,
} from '@/app/app/finance/gastos-actions'
import type { MovimientoRow } from '@/lib/gastos'
import {
  etiquetaPeriodo, PERIODICIDADES, resumenRecurrentes, type RecurrenteRow,
} from '@/lib/recurrentes'
import { MASCARA, useOculto } from './privado'
import {
  btnIcon, btnOutline, btnPrimary, cardClass, eur, fmtDiaAnio, SIN_CATEGORIA, TIPOS,
} from './comun'

type Accion = Promise<{ ok: boolean; message?: string }>

/** Normaliza para buscar: sin mayúsculas y sin tildes ("cafe" encuentra "Café").
 *  NFD separa la letra de su tilde y el reemplazo se lleva los diacríticos. */
const clave = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export function AjustesTab({ categorias, recurrentes, years, hoy }: {
  categorias: CategoriaRow[]
  recurrentes: RecurrenteRow[]
  years: YearSummary[]
  hoy: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <PanelCategorias categorias={categorias} />
      <PanelRecurrentes filas={recurrentes} categorias={categorias} hoy={hoy} />
      <PanelAnios years={years} />
    </div>
  )
}

/** Cabecera común de los bloques: título, resumen y (si se pide) buscador. */
function Cabecera({ icono, titulo, resumen, busqueda, onBuscar, children }: {
  icono: React.ReactNode
  titulo: string
  resumen: string
  /** Sin `onBuscar` no se pinta el buscador (los años son cuatro, no 19). */
  busqueda?: string
  onBuscar?: (v: string) => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-3">
      <h2 className="flex items-center gap-2 font-semibold">
        {icono}
        {titulo}
      </h2>
      <p className="text-[12.5px] text-muted-foreground">{resumen}</p>
      {/* En móvil las tres piezas se APILAN (columna), no se reparten por
          wrapping: buscador, filtros y botón de alta, cada uno en su fila y a
          lo ancho. Compartiendo fila se pisaban entre ellas. */}
      <div className="ml-auto flex items-center gap-2 max-sm:w-full max-sm:flex-col max-sm:items-stretch">
        {/* Sin icono de lupa dentro del campo: se montaba encima del
            placeholder, y "Buscar..." ya dice lo que hace. */}
        {onBuscar && (
          <TextField
            className="w-44 max-sm:w-full"
            ariaLabel={`Buscar en ${titulo.toLowerCase()}`}
            placeholder="Buscar..."
            value={busqueda ?? ''}
            onChange={onBuscar}
          />
        )}
        {children}
      </div>
    </div>
  )
}

/** Filtros en línea (chips): uno activo a la vez. */
function Filtros<T extends string>({ valor, onCambio, opciones, etiqueta }: {
  valor: T
  onCambio: (v: T) => void
  opciones: Array<{ value: T; label: string }>
  etiqueta: string
}) {
  return (
    <div
      className="flex rounded-lg border border-border bg-card/50 p-0.5"
      role="group"
      aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cn(
            // py-2 en móvil: 27px de alto es un objetivo táctil corto.
            // whitespace-nowrap: en móvil el chip se estrecha y "En pausa" se
            // partía en dos líneas, subiendo la fila entera a 54px.
            'whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition-colors max-sm:flex-1 max-sm:py-2',
            valor === o.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onCambio(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─────────── categorías ───────────

type FiltroCat = 'todas' | 'GASTO' | 'INGRESO' | 'tope'

const FILTROS_CAT: Array<{ value: FiltroCat; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'GASTO', label: 'Gasto' },
  { value: 'INGRESO', label: 'Ingreso' },
  { value: 'tope', label: 'Tope' },
]

interface BorradorCat {
  name: string
  type: TipoMovimiento
  budget: number | null
}

const CAT_VACIA: BorradorCat = { name: '', type: 'GASTO', budget: null }

function PanelCategorias({ categorias }: { categorias: CategoriaRow[] }) {
  const [pending, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroCat>('todas')
  const [fusionando, setFusionando] = useState<string | null>(null)
  const [destino, setDestino] = useState('')
  const [confirmando, setConfirmando] = useState<string | null>(null)
  // Alta y edición comparten formulario y modal: `editando` es la categoría en
  // curso, o null cuando se está creando una nueva.
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<CategoriaRow | null>(null)
  const [borrador, setBorrador] = useState<BorradorCat>(CAT_VACIA)

  const run = (promise: Accion, success: string, luego?: () => void) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(res.message ?? success)
      luego?.()
    })

  const conTope = categorias.filter((c) => c.budget !== null).length
  const q = clave(busqueda.trim())
  const visibles = categorias.filter((c) => {
    if (q && !clave(c.name).includes(q)) return false
    if (filtro === 'tope') return c.budget !== null
    if (filtro === 'GASTO' || filtro === 'INGRESO') return c.type === filtro
    return true
  })

  const porTipo = (tipo: TipoMovimiento) => visibles.filter((c) => c.type === tipo)

  const listar = (tipo: TipoMovimiento) => {
    const grupo = porTipo(tipo)
    return (
      <div key={tipo}>
        <p className="mb-1 mt-4 text-[13px] font-semibold text-muted-foreground first:mt-0">
          {tipo === 'GASTO' ? 'Categorías de gasto' : 'Categorías de ingreso'}
        </p>
        {grupo.length === 0 && (
          <p className="pb-1 text-[13px] text-muted-foreground/70">
            {busqueda.trim() || filtro === 'tope' ? 'Ninguna con ese criterio.' : 'Ninguna todavía.'}
          </p>
        )}
        {grupo.map((c) => (
          <div key={c.uuid} className="border-b border-border/60 py-2">
            {fusionando === c.uuid ? (
              <FusionarFila
                origen={c}
                candidatas={categorias.filter((o) => o.type === c.type && o.uuid !== c.uuid)}
                destino={destino}
                onDestino={setDestino}
                pending={pending}
                onCancelar={() => setFusionando(null)}
                onFusionar={() =>
                  run(fusionarCategorias(c.uuid, destino), 'Categorías fusionadas', () => {
                    setFusionando(null)
                    setDestino('')
                  })
                }
              />
            ) : (
              // En móvil, DOS líneas fijas (nombre y tope arriba; usos y
              // acciones abajo) en vez de dejar que el wrapping reparta cinco
              // piezas: con `sm:contents` los envoltorios desaparecen en
              // escritorio y todo vuelve a una sola fila.
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <div className="flex min-w-0 items-center gap-2 sm:contents">
                  <span className="inline-block size-3 shrink-0 rounded" style={{ background: c.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                  {c.budget !== null && (
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-foreground">
                      {eur(c.budget)}/mes
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 max-sm:ml-5 sm:contents">
                  <span className="min-w-0 flex-1 text-[12px] text-muted-foreground sm:flex-none sm:shrink-0">
                    {usosTexto(c)}
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className={btnIcon}
                    aria-label={`Fusionar ${c.name}`}
                    title="Fusionar con otra categoría"
                    onClick={() => {
                      setConfirmando(null)
                      setEditando(null)
                      setDestino('')
                      setFusionando(c.uuid)
                    }}>
                    <Merge className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className={btnIcon}
                    aria-label={`Editar ${c.name}`}
                    onClick={() => {
                      setConfirmando(null)
                      setFusionando(null)
                      setBorrador({ name: c.name, type: c.type, budget: c.budget })
                      setEditando(c)
                      setAbierto(true)
                    }}>
                    <Pencil className="size-3.5" />
                  </button>
                  {/* Una categoría en uso NO se borra: perder la clasificación
                      de todo su historial en un clic no es una opción. Para
                      quitarla de en medio está fusionar. */}
                  <button
                    type="button"
                    className={cn(
                      btnIcon,
                      enUso(c)
                        ? 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground'
                        : 'hover:bg-danger-bg hover:text-danger',
                    )}
                    aria-label={`Eliminar ${c.name}`}
                    title={
                      enUso(c)
                        ? `No se puede borrar: la usan ${usosTexto(c, ' y ')}. Fusiónala en otra.`
                        : 'Eliminar'
                    }
                    aria-disabled={enUso(c)}
                    onClick={() => {
                      if (enUso(c)) {
                        toast.error(
                          `«${c.name}» no se puede borrar: la usan ${usosTexto(c, ' y ')}. Fusiónala en otra categoría.`,
                        )
                        return
                      }
                      setConfirmando(confirmando === c.uuid ? null : c.uuid)
                    }}>
                    <Trash2 className="size-3.5" />
                  </button>
                  </span>
                </div>
              </div>
            )}

            {/* Solo llega aquí una categoría sin uso: no hay nada que arrastre. */}
            {confirmando === c.uuid && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-danger-bg px-3 py-2 text-[12.5px]">
                <span className="min-w-0 flex-1">Eliminar «{c.name}»: no la usa nada.</span>
                <button
                  type="button"
                  className="rounded-md bg-danger px-2.5 py-1 text-xs font-semibold text-white max-sm:px-3 max-sm:py-2"
                  disabled={pending}
                  onClick={() => {
                    setConfirmando(null)
                    run(deleteCategoria(c.uuid), `Categoría ${c.name} eliminada`)
                  }}>
                  Eliminar
                </button>
                <button type="button" className={btnIcon} aria-label="Cancelar" onClick={() => setConfirmando(null)}>
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  const abrirAlta = () => {
    setBorrador(CAT_VACIA)
    setEditando(null)
    setAbierto(true)
  }

  const cerrar = () => {
    setAbierto(false)
    setEditando(null)
  }

  const guardar = () => {
    if (!borrador.name.trim()) return
    if (editando) {
      run(
        updateCategoria(editando.uuid, { name: borrador.name, budget: borrador.budget }),
        'Categoría actualizada',
        cerrar,
      )
      return
    }
    run(createCategoria(borrador), 'Categoría creada', cerrar)
  }

  return (
    <section className={cardClass}>
      <Cabecera
        icono={<Tag className="size-4 text-primary" />}
        titulo="Categorías"
        resumen={`${categorias.length} en total · ${conTope} con tope`}
        busqueda={busqueda}
        onBuscar={setBusqueda}>
        <Filtros valor={filtro} onCambio={setFiltro} opciones={FILTROS_CAT} etiqueta="Filtrar categorías" />
        <button
          type="button"
          className={cn(btnPrimary, 'px-2.5 py-1 text-[12.5px] max-sm:py-2')}
          onClick={abrirAlta}>
          <Plus className="size-3.5" /> Nueva
        </button>
      </Cabecera>

      <div className="px-5 py-3">
        {/* Con el filtro de tope solo se pinta el grupo de gasto: una categoría
            de ingreso no puede tener tope, y salía un "ninguna" de relleno. */}
        {(filtro === 'INGRESO'
          ? (['INGRESO'] as const)
          : filtro === 'GASTO' || filtro === 'tope'
            ? (['GASTO'] as const)
            : (['GASTO', 'INGRESO'] as const)
        ).map(listar)}
      </div>

      {/* Alta y edición, en el mismo modal: los campos son los mismos y el
          tipo, que no se puede cambiar después, solo se ofrece al crear. */}
      {abierto && (
        <Modal
          title={editando ? `Editar «${editando.name}»` : 'Nueva categoría'}
          description={
            editando
              ? 'El tipo no se cambia: una categoría de gasto y una de ingreso son listas distintas.'
              : 'El color lo elige la aplicación, siempre distinto de los que ya hay.'
          }
          onClose={cerrar}
          footer={
            <>
              <button type="button" className={btnOutline} onClick={cerrar}>
                Cancelar
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={pending || !borrador.name.trim()}
                onClick={guardar}>
                {editando ? 'Guardar' : 'Crear'}
              </button>
            </>
          }>
          <div className="flex flex-col gap-3">
            {!editando && (
              <Campo etiqueta="Tipo">
                <SelectField
                  className="w-32"
                  ariaLabel="Tipo de la categoría"
                  value={borrador.type}
                  onChange={(v) => setBorrador((b) => ({ ...b, type: v as TipoMovimiento }))}
                  options={TIPOS}
                />
              </Campo>
            )}
            <Campo etiqueta="Nombre">
              <TextField
                autoFocus
                ariaLabel="Nombre de la categoría"
                placeholder="Nombre"
                value={borrador.name}
                onChange={(v) => setBorrador((b) => ({ ...b, name: v }))}
                onEnter={guardar}
              />
            </Campo>
            {borrador.type === 'GASTO' && (
              <Campo etiqueta="Tope al mes">
                <NumberField
                  className="w-32"
                  step={10}
                  placeholder="Sin tope"
                  ariaLabel="Tope mensual de la categoría"
                  value={borrador.budget}
                  onChange={(v) => setBorrador((b) => ({ ...b, budget: v }))}
                />
              </Campo>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}

/** Etiqueta encima del campo, para los formularios de los modales. */
function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] text-muted-foreground">{etiqueta}</span>
      {children}
    </label>
  )
}

/** "27 movimientos · 2 recurrentes" (o "sin uso"). Dentro de una frase se pide
 *  con `union = ' y '`, que es como se lee en español. */
function usosTexto(c: CategoriaRow, union = ' · ') {
  const partes = [
    c.usos > 0 ? `${c.usos} ${c.usos === 1 ? 'movimiento' : 'movimientos'}` : '',
    c.usosRecurrentes > 0
      ? `${c.usosRecurrentes} ${c.usosRecurrentes === 1 ? 'recurrente' : 'recurrentes'}`
      : '',
  ].filter(Boolean)
  return partes.length ? partes.join(union) : 'sin uso'
}

/** Si algo la usa, no se puede borrar (hay que fusionarla). */
const enUso = (c: CategoriaRow) => c.usos > 0 || c.usosRecurrentes > 0

/** Fila desplegada para fusionar una categoría en otra del mismo tipo. */
function FusionarFila({ origen, candidatas, destino, onDestino, pending, onCancelar, onFusionar }: {
  origen: CategoriaRow
  candidatas: CategoriaRow[]
  destino: string
  onDestino: (v: string) => void
  pending: boolean
  onCancelar: () => void
  onFusionar: () => void
}) {
  const elegida = candidatas.find((c) => c.uuid === destino)
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
      <p className="text-[13px]">
        Fusionar <strong>{origen.name}</strong> en:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <SelectField
          className="min-w-0 flex-1 max-sm:basis-full"
          ariaLabel={`Categoría de destino para ${origen.name}`}
          placeholder="Elige una categoría"
          value={destino}
          onChange={onDestino}
          options={candidatas.map((c) => ({ value: c.uuid, label: c.name }))}
        />
        <button type="button" className={btnOutline} onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className={btnPrimary} disabled={pending || !destino} onClick={onFusionar}>
          Fusionar
        </button>
      </div>
      {elegida && (
        <p className="text-[12.5px] text-muted-foreground">
          {usosTexto(origen, ' y ')} de «{origen.name}»{' '}
          {origen.usos + origen.usosRecurrentes === 1 ? 'pasará' : 'pasarán'}{' '}
          a «{elegida.name}», y «{origen.name}» desaparecerá.
        </p>
      )}
    </div>
  )
}

// ─────────── recurrentes ───────────

interface BorradorRec {
  type: TipoMovimiento
  concept: string
  amount: number | null
  intervalMonths: number
  nextDate: string
  cat: string
}

const OPCIONES_PERIODO = PERIODICIDADES.map((p) => ({ value: String(p.meses), label: p.label }))

type FiltroRec = 'todos' | 'activos' | 'pausados'

const FILTROS_REC: Array<{ value: FiltroRec; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'activos', label: 'Activos' },
  { value: 'pausados', label: 'En pausa' },
]

/**
 * Campos de un recurrente, los mismos para el alta y la edición: seis campos
 * son demasiados para mantener dos copias, que es la forma segura de que
 * acaben distintas. Los botones los pone el pie del modal.
 */
function FormRecurrente({ valor, onChange, categorias, onGuardar }: {
  valor: BorradorRec
  onChange: (v: BorradorRec) => void
  categorias: CategoriaRow[]
  /** Se dispara con Enter en el concepto. */
  onGuardar: () => void
}) {
  const opcionesCat = [
    { value: '', label: 'Sin categoría' },
    ...categorias
      .filter((c) => c.type === valor.type)
      .map((c) => ({ value: c.uuid, label: c.name })),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Tipo">
          <SelectField
            ariaLabel="Tipo del recurrente"
            value={valor.type}
            onChange={(v) => onChange({ ...valor, type: v as TipoMovimiento, cat: '' })}
            options={TIPOS}
          />
        </Campo>
        <Campo etiqueta="Importe">
          <NumberField
            ariaLabel="Importe del recurrente"
            placeholder="Importe"
            step={10}
            value={valor.amount}
            onChange={(v) => onChange({ ...valor, amount: v })}
          />
        </Campo>
      </div>
      <Campo etiqueta="Concepto">
        <TextField
          autoFocus
          ariaLabel="Concepto del recurrente"
          placeholder="Concepto"
          value={valor.concept}
          onChange={(v) => onChange({ ...valor, concept: v })}
          onEnter={onGuardar}
        />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Cada cuánto">
          <SelectField
            ariaLabel="Cada cuánto se repite"
            value={String(valor.intervalMonths)}
            onChange={(v) => onChange({ ...valor, intervalMonths: Number(v) })}
            options={OPCIONES_PERIODO}
          />
        </Campo>
        <Campo etiqueta="Próximo cargo">
          <DateField
            ariaLabel="Fecha del próximo cargo"
            value={valor.nextDate}
            onChange={(v) => onChange({ ...valor, nextDate: v })}
          />
        </Campo>
      </div>
      <Campo etiqueta="Categoría">
        <SelectField
          ariaLabel="Categoría del recurrente"
          value={valor.cat}
          onChange={(v) => onChange({ ...valor, cat: v })}
          options={opcionesCat}
        />
      </Campo>
    </div>
  )
}

function PanelRecurrentes({ filas, categorias, hoy }: {
  filas: RecurrenteRow[]
  categorias: CategoriaRow[]
  hoy: string
}) {
  const [pending, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroRec>('todos')
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const vacio: BorradorRec = {
    type: 'GASTO', concept: '', amount: null, intervalMonths: 1, nextDate: hoy, cat: '',
  }
  // Alta y edición, mismo formulario y mismo modal (ver PanelCategorias).
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<RecurrenteRow | null>(null)
  const [borrador, setBorrador] = useState<BorradorRec>(vacio)
  // Detalle desplegado de una fila y lo que ha apuntado: null mientras se pide,
  // 'error' si no se pudo leer (si no, se quedaría en "Cargando" para siempre).
  const [detalle, setDetalle] = useState<string | null>(null)
  const [cargados, setCargados] = useState<
    { total: number; movimientos: MovimientoRow[] } | 'error' | null
  >(null)

  const run = (promise: Accion, success: string, luego?: () => void) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(success)
      luego?.()
    })

  const datosDe = (b: BorradorRec) => ({
    type: b.type,
    concept: b.concept,
    amount: b.amount,
    intervalMonths: b.intervalMonths,
    nextDate: b.nextDate,
    categoryUuid: b.cat || null,
  })

  const abrirAlta = () => {
    setBorrador(vacio)
    setEditando(null)
    setAbierto(true)
  }

  const cerrar = () => {
    setAbierto(false)
    setEditando(null)
  }

  const guardar = () => {
    if (!borrador.concept.trim() || borrador.amount === null) return
    if (editando) {
      run(updateRecurrente(editando.uuid, datosDe(borrador)), 'Recurrente actualizado', cerrar)
      return
    }
    run(createRecurrente(datosDe(borrador)), 'Recurrente creado', cerrar)
  }

  const borradorDe = (r: RecurrenteRow): BorradorRec => ({
    type: r.type,
    concept: r.concept,
    amount: r.amount,
    intervalMonths: r.intervalMonths,
    nextDate: r.nextDate,
    cat: r.categoryUuid ?? '',
  })

  /** Abre (o cierra) el detalle y pide lo que ha apuntado ese recurrente. */
  const abrirDetalle = (r: RecurrenteRow) => {
    setConfirmando(null)
    if (detalle === r.uuid) return setDetalle(null)
    setDetalle(r.uuid)
    setCargados(null)
    if (r.generados === 0) return
    startTransition(async () => {
      const res = await leerMovimientosDeRecurrente(r.uuid)
      setCargados(res ?? 'error')
    })
  }

  /** Duplicar: abre el alta con los mismos valores; no escribe nada hasta crear. */
  const duplicar = (r: RecurrenteRow) => {
    setDetalle(null)
    setEditando(null)
    setBorrador({ ...borradorDe(r), concept: `${r.concept} (copia)` })
    setAbierto(true)
  }

  const resumen = resumenRecurrentes(filas)
  // Sin useMemo: el compilador de React ya memoiza esto solo, y a mano se
  // queja de no poder preservarlo (la lista son decenas de filas, no miles).
  const q = clave(busqueda.trim())
  const visibles = filas.filter((r) => {
    if (q && !clave(r.concept).includes(q)) return false
    if (filtro === 'activos') return r.active
    if (filtro === 'pausados') return !r.active
    return true
  })

  return (
    <section className={cardClass}>
      <Cabecera
        icono={<Repeat className="size-4 text-primary" />}
        titulo="Recurrentes"
        resumen={`${resumen.activos} activos · ${eur(resumen.gasto)} de gasto fijo al mes`}
        busqueda={busqueda}
        onBuscar={setBusqueda}>
        <Filtros valor={filtro} onCambio={setFiltro} opciones={FILTROS_REC} etiqueta="Filtrar recurrentes" />
        <button
          type="button"
          className={cn(btnPrimary, 'px-2.5 py-1 text-[12.5px] max-sm:py-2')}
          onClick={abrirAlta}>
          <Plus className="size-3.5" /> Nuevo
        </button>
      </Cabecera>

      <div className="px-5 py-3">
        {visibles.length === 0 && (
          <p className="py-1 text-[13px] text-muted-foreground">
            {filas.length === 0
              ? 'Ninguno todavía. Con «Nuevo» das de alta el primero: el alquiler, una suscripción o la nómina.'
              : 'Ninguno con ese criterio.'}
          </p>
        )}

        {visibles.map((r) => {
          const cat = categorias.find((c) => c.uuid === r.categoryUuid)
          const esGasto = r.type === 'GASTO'
          return (
            <div key={r.uuid} className="border-b border-border/60 py-2.5">
              {/* Mismas dos líneas que en categorías: concepto e importe
                  arriba, periodicidad y acciones abajo. En escritorio los
                  envoltorios desaparecen (`sm:contents`) y el orden original
                  lo recupera `sm:order-*`. */}
              <div
                className={cn(
                  'flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2',
                  !r.active && 'opacity-55',
                )}>
                <div className="flex min-w-0 items-center gap-2 sm:contents">
                  <span
                    className="inline-block size-3 shrink-0 rounded"
                    style={{ background: cat?.color ?? SIN_CATEGORIA }}
                    title={cat?.name ?? 'Sin categoría'}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.concept}</span>
                  <span
                    className={cn(
                      'shrink-0 text-[13px] font-semibold tabular-nums sm:order-2',
                      esGasto ? 'text-danger' : 'text-success',
                    )}>
                    {esGasto ? '−' : '+'}
                    {eur(r.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2 max-sm:ml-5 sm:contents">
                  <span className="min-w-0 flex-1 text-[12px] text-muted-foreground sm:order-1 sm:flex-none sm:shrink-0">
                    {etiquetaPeriodo(r.intervalMonths)}
                    {' · '}
                    {r.active ? `próximo ${fmtDiaAnio(r.nextDate, hoy)}` : 'en pausa'}
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 sm:order-3">
                    {/* Lo de menos uso (apuntar ya, duplicar, ver lo apuntado)
                        se despliega en línea: en la fila serían seis iconos. */}
                    <button
                      type="button"
                      className={btnIcon}
                      aria-label={`Más de ${r.concept}`}
                      title="Apuntar ahora, duplicar y ver lo apuntado"
                      aria-expanded={detalle === r.uuid}
                      onClick={() => abrirDetalle(r)}>
                      <ChevronDown
                        className={cn('size-3.5 transition-transform', detalle === r.uuid && 'rotate-180')}
                      />
                    </button>
                    <button
                      type="button"
                      className={btnIcon}
                      aria-label={r.active ? `Pausar ${r.concept}` : `Reactivar ${r.concept}`}
                      title={r.active ? 'Pausar' : 'Reactivar'}
                      disabled={pending}
                      onClick={() =>
                        run(
                          updateRecurrente(r.uuid, { active: !r.active }),
                          r.active ? 'Recurrente en pausa' : 'Recurrente reactivado',
                        )
                      }>
                      {r.active ? <Pause className="size-3.5" /> : <Check className="size-3.5" />}
                    </button>
                    <button
                      type="button"
                      className={btnIcon}
                      aria-label={`Editar ${r.concept}`}
                      onClick={() => {
                        setConfirmando(null)
                        setDetalle(null)
                        setBorrador(borradorDe(r))
                        setEditando(r)
                        setAbierto(true)
                      }}>
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className={cn(btnIcon, 'hover:bg-danger-bg hover:text-danger')}
                      aria-label={`Eliminar ${r.concept}`}
                      onClick={() => setConfirmando(confirmando === r.uuid ? null : r.uuid)}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>
              </div>

              {/* Detalle: apuntar ya, duplicar y lo que lleva apuntado. */}
              {detalle === r.uuid && (
                <div className="mt-2 flex flex-col gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5">
                  {/* En móvil, un botón por fila: "Apuntar el cargo del 03/09"
                      no cabe en media fila y se partía en dos líneas. */}
                  <div className="flex flex-wrap items-center gap-2 max-sm:flex-col max-sm:items-stretch">
                    <button
                      type="button"
                      className={cn(btnOutline, 'px-2.5 py-1 text-[12.5px] max-sm:py-2')}
                      disabled={pending}
                      title="Hace lo mismo que hará el cron, pero ya"
                      onClick={() =>
                        run(apuntarRecurrenteAhora(r.uuid), 'Cargo apuntado', () => setDetalle(null))
                      }>
                      <PlayCircle className="size-3.5" />
                      Apuntar el cargo del {fmtDiaAnio(r.nextDate, hoy)}
                    </button>
                    <button
                      type="button"
                      className={cn(btnOutline, 'px-2.5 py-1 text-[12.5px] max-sm:py-2')}
                      title="Dar de alta otro igual, cambiando lo que haga falta"
                      onClick={() => duplicar(r)}>
                      <Copy className="size-3.5" />
                      Duplicar
                    </button>
                  </div>

                  {/* Lo que ha apuntado: la lista se pide al abrir el detalle. */}
                  {r.generados === 0 ? (
                    <p className="text-[12.5px] text-muted-foreground">
                      Todavía no ha apuntado ningún movimiento.
                    </p>
                  ) : cargados === null ? (
                    <p className="text-[12.5px] text-muted-foreground">Cargando lo apuntado...</p>
                  ) : cargados === 'error' ? (
                    <p className="text-[12.5px] text-muted-foreground">
                      No se ha podido cargar lo apuntado.{' '}
                      {r.generados === 1
                        ? 'El movimiento sigue'
                        : `Los ${r.generados} movimientos siguen`}{' '}
                      en la lista de su mes.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <p className="text-[12.5px] font-semibold text-muted-foreground">
                        Ha apuntado {cargados.total}{' '}
                        {cargados.total === 1 ? 'movimiento' : 'movimientos'}
                      </p>
                      {cargados.movimientos.map((m) => (
                        <span
                          key={m.uuid}
                          className="flex items-center gap-2 text-[12.5px] tabular-nums">
                          <span className="w-24 shrink-0 text-muted-foreground">
                            {fmtDiaAnio(m.expenseDate, hoy)}
                          </span>
                          <span
                            className={cn(
                              'font-semibold',
                              m.type === 'GASTO' ? 'text-danger' : 'text-success',
                            )}>
                            {m.type === 'GASTO' ? '−' : '+'}
                            {eur(m.amount)}
                          </span>
                        </span>
                      ))}
                      {cargados.total > cargados.movimientos.length && (
                        <span className="text-[12px] text-muted-foreground/80">
                          y {cargados.total - cargados.movimientos.length} más, en la lista de
                          movimientos de su mes.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {confirmando === r.uuid && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-danger-bg px-3 py-2 text-[12.5px]">
                  <span className="min-w-0 flex-1">
                    Eliminar «{r.concept}»: dejará de apuntarse. Los movimientos que ya generó se
                    quedan como están.
                  </span>
                  <button
                    type="button"
                    className="rounded-md bg-danger px-2.5 py-1 text-xs font-semibold text-white max-sm:px-3 max-sm:py-2"
                    disabled={pending}
                    onClick={() => {
                      setConfirmando(null)
                      run(deleteRecurrente(r.uuid), `${r.concept} eliminado`)
                    }}>
                    Eliminar
                  </button>
                  <button type="button" className={btnIcon} aria-label="Cancelar" onClick={() => setConfirmando(null)}>
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          )
        })}

      </div>

      {/* Alta y edición en el mismo modal: seis campos no caben en la fila. */}
      {abierto && (
        <Modal
          title={editando ? `Editar «${editando.concept}»` : 'Nuevo recurrente'}
          description="La fecha es la del próximo cargo: si ya ha pasado, se apuntará en la siguiente pasada del aviso diario."
          onClose={cerrar}
          footer={
            <>
              <button type="button" className={btnOutline} onClick={cerrar}>
                Cancelar
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={pending || !borrador.concept.trim() || borrador.amount === null}
                onClick={guardar}>
                {editando ? 'Guardar' : 'Crear'}
              </button>
            </>
          }>
          <FormRecurrente
            valor={borrador}
            onChange={setBorrador}
            categorias={categorias}
            onGuardar={guardar}
          />
        </Modal>
      )}
    </section>
  )
}

// ─────────── años de ahorro ───────────

interface BorradorAnio {
  year: number | null
  goal: number | null
}

/**
 * Años del sistema de ahorro: crear, renombrar, cambiar el objetivo, exportar
 * a Excel y eliminar.
 *
 * Estaba en el modal «Gestionar años» de las pestañas de Ahorro. Se trajo aquí
 * el 28/08/2026 para que toda la configuración de Finanzas viva en un sitio;
 * las pestañas de Ahorro se quedan solo para navegar entre años.
 */
function PanelAnios({ years }: { years: YearSummary[] }) {
  const [pending, startTransition] = useTransition()
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<YearSummary | null>(null)
  const [borrador, setBorrador] = useState<BorradorAnio>({ year: null, goal: null })
  const oculto = useOculto()

  const run = (promise: Accion, success: string, luego?: () => void) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(success)
      luego?.()
    })

  const cerrar = () => {
    setAbierto(false)
    setEditando(null)
  }

  const abrirAlta = () => {
    // Propone el siguiente al último creado: es lo que se hace el 99% de las veces.
    const ultimo = years[years.length - 1]?.year ?? new Date().getFullYear() - 1
    setBorrador({ year: ultimo + 1, goal: null })
    setEditando(null)
    setAbierto(true)
  }

  const guardar = () => {
    if (borrador.year === null) return
    if (editando) {
      run(
        updateYear(editando.uuid, { year: borrador.year, goal: borrador.goal }),
        'Año actualizado',
        cerrar,
      )
      return
    }
    run(createYear({ year: borrador.year, goal: borrador.goal }), `Año ${borrador.year} creado`, cerrar)
  }

  // Objetivo del año en curso, si lo hay: es el dato que se consulta.
  const enCurso = years.find((y) => y.year === new Date().getFullYear())
  const resumen = [
    `${years.length} ${years.length === 1 ? 'año' : 'años'}`,
    enCurso?.goal ? `objetivo de ${enCurso.year}: ${oculto ? MASCARA : eur(enCurso.goal)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className={cardClass}>
      <Cabecera
        icono={<CalendarRange className="size-4 text-primary" />}
        titulo="Años de ahorro"
        resumen={resumen}>
        <button
          type="button"
          className={cn(btnPrimary, 'px-2.5 py-1 text-[12.5px] max-sm:py-2')}
          onClick={abrirAlta}>
          <Plus className="size-3.5" /> Nuevo
        </button>
      </Cabecera>

      <div className="px-5 py-3">
        {years.length === 0 && (
          <p className="py-1 text-[13px] text-muted-foreground">
            Ningún año todavía. Con «Nuevo» creas el primero y ya puedes rellenar sus meses.
          </p>
        )}

        {years.map((y) => (
          <div key={y.uuid} className="border-b border-border/60 py-2">
            {/* Dos líneas en móvil, una en escritorio, como los otros bloques. */}
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex min-w-0 items-center gap-2 sm:contents">
                <span className="min-w-0 flex-1 text-sm font-semibold tabular-nums">{y.year}</span>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-foreground">
                  {y.goal === null ? 'Sin objetivo' : `${oculto ? MASCARA : eur(y.goal)} al año`}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:contents">
                <span className="min-w-0 flex-1 text-[12px] text-muted-foreground sm:flex-none sm:shrink-0">
                  {mesesRellenos(y)}
                </span>
                <span className="flex shrink-0 items-center gap-0.5">
                  {/* Descarga del Excel del año (route handler con guarda propia) */}
                  <a
                    className={btnIcon}
                    href={`/app/finance/exportar?year=${y.year}`}
                    title="Descargar Excel"
                    aria-label={`Descargar Excel de ${y.year}`}>
                    <FileDown className="size-3.5" />
                  </a>
                  <button
                    type="button"
                    className={btnIcon}
                    aria-label={`Editar ${y.year}`}
                    onClick={() => {
                      setConfirmando(null)
                      setBorrador({ year: y.year, goal: y.goal })
                      setEditando(y)
                      setAbierto(true)
                    }}>
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className={cn(btnIcon, 'hover:bg-danger-bg hover:text-danger')}
                    aria-label={`Eliminar ${y.year}`}
                    onClick={() => setConfirmando(confirmando === y.uuid ? null : y.uuid)}>
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </div>
            </div>

            {confirmando === y.uuid && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-danger-bg px-3 py-2 text-[12.5px]">
                <span className="min-w-0 flex-1">
                  Eliminar {y.year}: se borra el año <strong>con todo su detalle</strong> (
                  {mesesRellenos(y)}, ingresos extra y viajes). Los movimientos de Gastos no se
                  tocan: no cuelgan del año.
                </span>
                <button
                  type="button"
                  className="rounded-md bg-danger px-2.5 py-1 text-xs font-semibold text-white max-sm:px-3 max-sm:py-2"
                  disabled={pending}
                  onClick={() => {
                    setConfirmando(null)
                    run(deleteYear(y.uuid), `Año ${y.year} eliminado`)
                  }}>
                  Eliminar
                </button>
                <button type="button" className={btnIcon} aria-label="Cancelar" onClick={() => setConfirmando(null)}>
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {abierto && (
        <Modal
          title={editando ? `Editar ${editando.year}` : 'Nuevo año de ahorro'}
          description="El objetivo es opcional: sin él, el año funciona igual pero sin barra de progreso ni proyección."
          onClose={cerrar}
          footer={
            <>
              <button type="button" className={btnOutline} onClick={cerrar}>
                Cancelar
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={pending || borrador.year === null}
                onClick={guardar}>
                {editando ? 'Guardar' : 'Crear'}
              </button>
            </>
          }>
          <div className="flex flex-col gap-3">
            <Campo etiqueta="Año">
              <NumberField
                className="w-32"
                step={1}
                ariaLabel="Año"
                value={borrador.year}
                onChange={(v) => setBorrador((b) => ({ ...b, year: v }))}
              />
            </Campo>
            <Campo etiqueta="Objetivo de ahorro">
              <NumberField
                className="w-32"
                step={50}
                placeholder="Sin objetivo"
                ariaLabel="Objetivo anual"
                value={borrador.goal}
                onChange={(v) => setBorrador((b) => ({ ...b, goal: v }))}
                onEnter={guardar}
              />
            </Campo>
          </div>
        </Modal>
      )}
    </section>
  )
}

/** "8 meses rellenos" — los que tienen ahorro general apuntado. */
function mesesRellenos(y: YearSummary) {
  const n = y.generalPorMes.filter((v) => v !== null).length
  if (n === 0) return 'sin meses rellenos'
  return `${n} ${n === 1 ? 'mes relleno' : 'meses rellenos'}`
}
