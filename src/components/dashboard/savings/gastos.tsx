'use client'

// Vista "Gastos" de Finanzas, réplica del Excel "Control de gastos": cada
// movimiento es un ingreso o un gasto. Dos sub-vistas — el MES (resumen,
// lista con alta rápida, topes, recurrentes y los dos desgloses) y el AÑO (mes
// a mes con balance y desgloses del año). Es una vista de CONSULTA y alta
// rápida de MOVIMIENTOS: gestionar categorías, topes y recurrentes es cosa de
// la sección Ajustes (`?s=ajustes`, ajustes.tsx), sin atajos desde aquí.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useCarga } from '@/components/dashboard/barra-carga'
import {
  Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, TrendingDown, TrendingUp, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { DateField, NumberField, SelectField, TextField } from '@/components/ui/fields'
import type {
  AnioMovimientos, CategoriaRow, MesMovimientos, MovimientoRow, ParteCategoria, TipoMovimiento,
} from '@/lib/gastos'
import { createGasto, deleteGasto, updateGasto } from '@/app/app/finance/gastos-actions'
import { GraficaBarras } from '@/components/ui/charts/barras'
import { coloresTema } from '@/components/ui/charts/comun'
import { GraficaDonut } from '@/components/ui/charts/donut'
import { MESES, mesCorto } from '@/lib/fechas'
import { nivelTope, resumenTopes, type TopeRow } from '@/lib/topes'
import { etiquetaPeriodo, resumenRecurrentes, type RecurrenteRow } from '@/lib/recurrentes'
import { ejeEuros, ejeMeses } from './charts'
import {
  btnIcon, btnPrimary, cardClass, eur, fmtDia, fmtDiaAnio, SIN_CATEGORIA, TIPOS,
} from './comun'

/** 'YYYY-MM' → 'Agosto 2026'. */
const nombreMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return `${MESES[m - 1]} ${y}`
}

/** Desplaza un 'YYYY-MM' N meses (cruzando de año). */
const moverMes = (mes: string, delta: number) => {
  const [y, m] = mes.split('-').map(Number)
  const total = m - 1 + delta
  const y2 = y + Math.floor(total / 12)
  const m2 = ((total % 12) + 12) % 12
  return `${y2}-${String(m2 + 1).padStart(2, '0')}`
}

// ─────────── piezas comunes ───────────

function Kpi({ label, valor, pie, tono }: {
  label: string
  valor: string
  pie?: React.ReactNode
  tono?: 'success' | 'danger' | 'primary'
}) {
  return (
    <div className={cn(cardClass, 'p-4')}>
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1.5 text-2xl font-semibold tabular-nums',
          tono === 'success' && 'text-success',
          tono === 'danger' && 'text-danger',
          tono === 'primary' && 'text-primary',
        )}>
        {valor}
      </p>
      {pie && <p className="mt-1 text-[12px] text-muted-foreground">{pie}</p>}
    </div>
  )
}

/** Comparativa contra el mes anterior. En gastos, subir es malo. */
function Comparativa({ actual, previo, gastoEsMalo }: {
  actual: number
  previo: number
  gastoEsMalo: boolean
}) {
  if (previo <= 0) return <>sin dato del mes anterior</>
  const delta = Math.round(((actual - previo) / previo) * 100)
  // Empatar (o redondear a 0%) no es ni bueno ni malo: se muestra neutro.
  if (delta === 0) return <>igual que el mes anterior</>
  const sube = delta > 0
  const malo = gastoEsMalo ? sube : !sube
  return (
    <span className={cn('inline-flex items-center gap-1', malo ? 'text-danger' : 'text-success')}>
      {sube ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {sube ? '+' : ''}
      {delta}&nbsp;% frente a {eur(previo)}
    </span>
  )
}

/**
 * Topes del mes: una barra por categoría con tope, de la más apurada a la que
 * más margen le queda.
 *
 * Va aquí y no arriba a propósito: el alta rápida de movimientos tiene que
 * quedar a mano en móvil, y esto se consulta, no se teclea. Cuando no hay
 * ningún tope la tarjeta sigue saliendo con la pista de dónde ponerlos — un
 * módulo invisible es un módulo que no se usa.
 */
function Topes({ topes, mes }: { topes: TopeRow[]; mes: string }) {
  const resumen = resumenTopes(topes)
  const pctTotal = resumen.total > 0 ? (resumen.gastado / resumen.total) * 100 : 0

  return (
    <div className={cn(cardClass, 'mt-4')}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-5 py-3">
        <h3 className="font-semibold">Topes de {nombreMes(mes)}</h3>
        {topes.length > 0 && (
          <p className="text-[12.5px] text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{eur(resumen.gastado)}</span>
            {' de '}
            <span className="tabular-nums">{eur(resumen.total)}</span>
            {resumen.restante >= 0 ? (
              <> · te quedan <span className="tabular-nums">{eur(resumen.restante)}</span></>
            ) : (
              <> · <span className="text-danger">te has pasado en <span className="tabular-nums">{eur(-resumen.restante)}</span></span></>
            )}
          </p>
        )}
      </div>

      {topes.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-muted-foreground">
          Ningún tope puesto. Dale un tope mensual a una categoría de gasto en la sección
          Ajustes y aquí verás cuánto llevas gastado de cada uno.
        </p>
      ) : (
        <div className="flex flex-col gap-3 px-5 py-4">
          {/* Barra del conjunto: la suma de todos los topes, para el vistazo. */}
          <BarraTope
            nombre="Todos los topes"
            color="var(--muted-foreground)"
            gastado={resumen.gastado}
            budget={resumen.total}
            pct={pctTotal}
            destacada
          />
          {topes.map((t) => (
            <BarraTope
              key={t.uuid}
              nombre={t.name}
              color={t.color}
              gastado={t.gastado}
              budget={t.budget}
              pct={t.pct}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Una fila de tope: nombre, cifras y barra coloreada por estado. */
function BarraTope({ nombre, color, gastado, budget, pct, destacada }: {
  nombre: string
  color: string
  gastado: number
  budget: number
  pct: number
  destacada?: boolean
}) {
  const nivel = nivelTope(pct)
  const tono =
    nivel === 'pasado' ? 'bg-danger' : nivel === 'limite' ? 'bg-warning' : 'bg-primary'
  const texto =
    nivel === 'pasado' ? 'text-danger' : nivel === 'limite' ? 'text-warning' : 'text-muted-foreground'

  return (
    <div className={cn(destacada && 'border-b border-border/60 pb-3')}>
      {/* En móvil el nombre solo tenía ~120px y se cortaba ("Transporte /
          Gasoli…"): ahí ocupa su propia línea y las cifras bajan a la
          siguiente, como en la lista de movimientos y en el modal. */}
      <div className="flex items-center gap-2 text-[13px] max-sm:flex-wrap">
        <span
          className="inline-block size-2.5 shrink-0 rounded-xs"
          style={{ background: color }}
        />
        <span className="min-w-0 flex-1 truncate font-semibold max-sm:basis-[calc(100%-1.75rem)]">
          {nombre}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground max-sm:ml-5 max-sm:flex-1">
          {eur(gastado)} <span className="text-muted-foreground/70">de {eur(budget)}</span>
        </span>
        <span className={cn('w-12 shrink-0 text-right font-semibold tabular-nums', texto)}>
          {Math.round(pct)}&nbsp;%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width]', tono)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Recurrentes activos: lo que va a caer solo, con su próximo cargo.
 *
 * El número que manda es el EQUIVALENTE MENSUAL: un seguro de 600 € al año son
 * 50 € al mes, y sumar solo los mensuales dejaría fuera justo los recibos
 * gordos. Los pausados no cuentan y solo se ven en el modal.
 */
function Recurrentes({ filas, mes, hoy, categorias }: {
  filas: RecurrenteRow[]
  mes: string
  hoy: string
  categorias: CategoriaRow[]
}) {
  const resumen = resumenRecurrentes(filas)
  const activos = filas.filter((r) => r.active)

  return (
    <div className={cn(cardClass, 'mt-4')}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-5 py-3">
        <h3 className="font-semibold">Recurrentes</h3>
        {resumen.activos > 0 && (
          <p className="text-[12.5px] text-muted-foreground">
            <span className="font-semibold tabular-nums text-danger">{eur(resumen.gasto)}</span>
            {' de gasto fijo al mes'}
            {resumen.ingreso > 0 && (
              <>
                {' · '}
                <span className="font-semibold tabular-nums text-success">{eur(resumen.ingreso)}</span>
                {' de ingreso'}
              </>
            )}
          </p>
        )}
      </div>

      {activos.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-muted-foreground">
          Ningún recurrente. Da de alta el alquiler, las suscripciones o la nómina y se apuntarán
          solos el día que toque, sin teclearlos cada mes.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60">
          {activos.map((r) => {
            const cat = categorias.find((c) => c.uuid === r.categoryUuid)
            const esGasto = r.type === 'GASTO'
            // "Ya cargado" solo si el último movimiento cayó en el mes que se
            // está viendo: en un mes pasado, el próximo cargo no dice nada.
            const cargado = r.lastCreated?.startsWith(mes) ? r.lastCreated : null
            // Vencido y sin apuntar: pasa cuando se acaba de dar de alta con
            // una fecha ya pasada. Lo recoge la siguiente pasada del cron.
            const pendiente = !cargado && r.nextDate <= hoy
            return (
              <div key={r.uuid} className="flex items-center gap-2 px-5 py-2.5 text-[13px] max-sm:flex-wrap">
                <span
                  className="inline-block size-2.5 shrink-0 rounded-xs"
                  style={{ background: cat?.color ?? SIN_CATEGORIA }}
                  title={cat?.name ?? 'Sin categoría'}
                />
                <span className="min-w-0 flex-1 truncate font-semibold max-sm:basis-[calc(100%-1.75rem)]">
                  {r.concept}
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground max-sm:ml-5">
                  {etiquetaPeriodo(r.intervalMonths)}
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground max-sm:flex-1 sm:w-36 sm:text-right">
                  {cargado ? (
                    <span className="text-success">cargado el {fmtDia(cargado)}</span>
                  ) : pendiente ? (
                    <span className="text-warning">
                      pendiente desde {fmtDiaAnio(r.nextDate, mes)}
                    </span>
                  ) : (
                    <>próximo {fmtDiaAnio(r.nextDate, mes)}</>
                  )}
                </span>
                <span
                  className={cn(
                    'shrink-0 font-semibold tabular-nums sm:w-24 sm:text-right',
                    esGasto ? 'text-danger' : 'text-success',
                  )}>
                  {esGasto ? '−' : '+'}
                  {eur(r.amount)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Desglose por categoría: donut + leyenda (el "en qué se va" del Excel). */
function Desglose({ titulo, partes, centro, vacio }: {
  titulo: string
  partes: ParteCategoria[]
  centro: string
  vacio: string
}) {
  return (
    // La rejilla estira las dos tarjetas a la misma altura: la del desglose
    // corto centra su donut en vez de dejarlo pegado arriba.
    <div className={cn(cardClass, 'flex flex-col')}>
      <h3 className="border-b border-border px-5 py-3 font-semibold">{titulo}</h3>
      <div className="flex flex-1 items-center px-5 py-4">
        <div className="w-full min-w-0">
          <GraficaDonut
            titulo={titulo}
            centro={centro}
            vacio={vacio}
            partes={partes.map((p) => ({ label: p.name, valor: p.total, color: p.color }))}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────── vista principal ───────────

export function GastosTab({
  datos, anio, categorias, recurrentes, mostrarAnio, hoy,
}: {
  datos: MesMovimientos
  anio: AnioMovimientos
  categorias: CategoriaRow[]
  recurrentes: RecurrenteRow[]
  mostrarAnio: boolean
  hoy: string // 'YYYY-MM-DD' (Madrid)
}) {
  const router = useRouter()
  const iniciar = useCarga()
  const [pending, startTransition] = useTransition()

  // Alta rápida: tipo gasto por defecto (es lo que más se apunta) y fecha
  // HOY si se está viendo el mes en curso; si no, el día 1 de ese mes.
  const fechaPorDefecto = hoy.startsWith(datos.mes) ? hoy : `${datos.mes}-01`
  const [nuevo, setNuevo] = useState<{
    type: TipoMovimiento; concept: string; amount: number | null; date: string; cat: string
  }>({ type: 'GASTO', concept: '', amount: null, date: fechaPorDefecto, cat: '' })
  // Edición inline
  const [editando, setEditando] = useState<string | null>(null)
  const [fila, setFila] = useState<{
    type: TipoMovimiento; concept: string; amount: number | null; date: string; cat: string
  }>({ type: 'GASTO', concept: '', amount: null, date: '', cat: '' })
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const run = (promise: Promise<{ ok: boolean; message?: string }>, success?: string, luego?: () => void) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      if (success) toast.success(success)
      luego?.()
    })

  // Navegar a un mes (dispara la barra de carga: son botones, no <a>).
  const irAMes = (mes: string) => {
    iniciar()
    router.push(`/app/finance?s=gastos&mes=${mes}`)
  }

  const crear = () => {
    if (!nuevo.concept.trim() || nuevo.amount === null) return
    run(
      createGasto({
        type: nuevo.type,
        concept: nuevo.concept,
        amount: nuevo.amount,
        expenseDate: nuevo.date,
        categoryUuid: nuevo.cat || null,
      }),
      nuevo.type === 'GASTO' ? 'Gasto añadido' : 'Ingreso añadido',
      () => setNuevo((n) => ({ ...n, concept: '', amount: null })),
    )
  }

  const guardarFila = (m: MovimientoRow) => {
    if (!fila.concept.trim() || fila.amount === null) return
    run(
      updateGasto(m.uuid, {
        type: fila.type,
        concept: fila.concept,
        amount: fila.amount,
        expenseDate: fila.date,
        categoryUuid: fila.cat || null,
      }),
      'Movimiento actualizado',
      () => setEditando(null),
    )
  }

  // Las categorías se ofrecen SEGÚN el tipo elegido (como el Excel, que tiene
  // dos listas): a un ingreso no se le ofrece "Supermercado".
  const opcionesCat = (tipo: TipoMovimiento) => [
    { value: '', label: 'Sin categoría' },
    ...categorias.filter((c) => c.type === tipo).map((c) => ({ value: c.uuid, label: c.name })),
  ]
  const catDe = (uuid: string | null) => categorias.find((c) => c.uuid === uuid)

  const año = Number(datos.mes.slice(0, 4))

  return (
    <div>
      {/* Barra: mes/año + gestión de categorías */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" className={btnIcon} aria-label="Mes anterior" onClick={() => irAMes(moverMes(datos.mes, -1))}>
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-36 text-center text-sm font-semibold">{nombreMes(datos.mes)}</span>
            <button type="button" className={btnIcon} aria-label="Mes siguiente" onClick={() => irAMes(moverMes(datos.mes, 1))}>
              <ChevronRight className="size-4" />
            </button>
          </div>
          {/* Conmutador mes / año (las dos vistas del Excel) */}
          <div className="flex rounded-lg border border-border bg-card/50 p-0.5">
            <button
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1 text-[13px] font-semibold transition-colors',
                mostrarAnio ? 'text-muted-foreground hover:text-foreground' : 'bg-muted text-foreground',
              )}
              onClick={() => irAMes(datos.mes)}>
              Mes
            </button>
            <button
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1 text-[13px] font-semibold transition-colors',
                mostrarAnio ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => {
                iniciar()
                router.push(`/app/finance?s=gastos&mes=${datos.mes}&vista=anio`)
              }}>
              Año {año}
            </button>
          </div>
        </div>
      </div>

      {mostrarAnio ? (
        <VistaAnio anio={anio} onMes={(m) => irAMes(`${anio.year}-${String(m).padStart(2, '0')}`)} />
      ) : (
        <>
          {/* Resumen del mes */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Ingresos del mes"
              valor={eur(datos.ingresos)}
              tono="success"
              pie={<Comparativa actual={datos.ingresos} previo={datos.ingresosPrevios} gastoEsMalo={false} />}
            />
            <Kpi
              label="Gastos del mes"
              valor={eur(datos.gastos)}
              tono="danger"
              pie={<Comparativa actual={datos.gastos} previo={datos.gastosPrevios} gastoEsMalo />}
            />
            <Kpi
              label="Balance del mes"
              valor={eur(datos.balance)}
              tono={datos.balance >= 0 ? 'primary' : 'danger'}
              pie={datos.balance >= 0 ? 'te queda a favor' : 'has gastado más de lo que entró'}
            />
            <Kpi
              label="Gasto medio al día"
              valor={eur(datos.gastoMedioDia)}
              pie={`${datos.movimientos.length} ${datos.movimientos.length === 1 ? 'movimiento' : 'movimientos'} este mes`}
            />
          </div>

          {/* Lista de movimientos */}
          <div className={cn(cardClass, 'mt-4')}>
            <h3 className="border-b border-border px-5 py-3 font-semibold">
              Movimientos de {nombreMes(datos.mes)}
            </h3>
            <div className="px-4 py-3">
              {/* ALTA, arriba y pensada para el pulgar: en el móvil se apunta
                  sobre la marcha, y bajar hasta el final de la lista para
                  encontrar el formulario no vale. En móvil va apilada (tipo
                  segmentado, importe y fecha en una fila, botón a lo ancho);
                  desde sm, una sola fila compacta. */}
              <div className="mb-3 flex flex-wrap gap-2 border-b border-border pb-3">
                {/* Tipo: en móvil dos botones grandes (es binario, un select
                    sobra); en escritorio, el select de la fila. */}
                <div className="flex w-full gap-1 rounded-lg border border-border bg-card/50 p-0.5 sm:hidden">
                  {TIPOS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={cn(
                        'flex-1 rounded-md py-2 text-sm font-semibold transition-colors',
                        nuevo.type === t.value
                          ? t.value === 'GASTO'
                            ? 'bg-danger-bg text-danger'
                            : 'bg-success-bg text-success'
                          : 'text-muted-foreground',
                      )}
                      onClick={() => setNuevo((n) => ({ ...n, type: t.value, cat: '' }))}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <SelectField
                  className="hidden w-24 shrink-0 sm:block"
                  ariaLabel="Tipo del movimiento"
                  value={nuevo.type}
                  onChange={(v) => setNuevo((n) => ({ ...n, type: v as TipoMovimiento, cat: '' }))}
                  options={TIPOS}
                />
                <TextField
                  className="w-full min-w-0 sm:w-auto sm:min-w-35 sm:flex-1"
                  placeholder="Concepto"
                  value={nuevo.concept}
                  onChange={(v) => setNuevo((n) => ({ ...n, concept: v }))}
                  onEnter={crear}
                />
                {/* Importe y fecha comparten fila en móvil */}
                <div className="min-w-0 flex-1 sm:w-24 sm:flex-none">
                  <NumberField
                    step={5}
                    ariaLabel="Importe"
                    placeholder="Importe"
                    value={nuevo.amount}
                    onChange={(v) => setNuevo((n) => ({ ...n, amount: v }))}
                    onEnter={crear}
                  />
                </div>
                <DateField
                  className="min-w-0 flex-1 sm:w-32 sm:flex-none"
                  ariaLabel="Fecha del movimiento"
                  value={nuevo.date}
                  onChange={(v) => setNuevo((n) => ({ ...n, date: v }))}
                />
                <SelectField
                  className="w-full min-w-0 sm:w-32 sm:flex-none"
                  ariaLabel="Categoría del movimiento"
                  value={nuevo.cat}
                  onChange={(v) => setNuevo((n) => ({ ...n, cat: v }))}
                  options={opcionesCat(nuevo.type)}
                />
                <button
                  type="button"
                  // py-2.5 en móvil: ~44px de alto, target táctil cómodo
                  className={cn(btnPrimary, 'w-full py-2.5 sm:w-auto sm:px-2.5 sm:py-1.5')}
                  aria-label="Añadir movimiento"
                  disabled={pending || !nuevo.concept.trim() || nuevo.amount === null}
                  onClick={crear}>
                  <Plus className="size-4" />
                  <span className="sm:hidden">
                    Añadir {nuevo.type === 'GASTO' ? 'gasto' : 'ingreso'}
                  </span>
                </button>
              </div>

              {datos.movimientos.length === 0 && (
                <p className="py-6 text-center text-[13px] text-muted-foreground">
                  Sin movimientos este mes. Apunta el primero arriba.
                </p>
              )}

              {datos.movimientos.map((m) => {
                const cat = catDe(m.categoryUuid)
                const esGasto = m.type === 'GASTO'
                return (
                  <div
                    key={m.uuid}
                    className={cn(
                      'flex items-center gap-2 border-b border-border/60 py-2 last:border-0',
                      editando === m.uuid && 'max-sm:flex-wrap',
                    )}>
                    {editando === m.uuid ? (
                      <>
                        <SelectField
                          className="w-24 shrink-0 max-sm:w-full max-sm:basis-full"
                          ariaLabel="Tipo"
                          value={fila.type}
                          onChange={(v) => setFila((f) => ({ ...f, type: v as TipoMovimiento, cat: '' }))}
                          options={TIPOS}
                        />
                        <TextField
                          className="min-w-0 flex-1 max-sm:basis-full"
                          ariaLabel="Concepto"
                          value={fila.concept}
                          onChange={(v) => setFila((f) => ({ ...f, concept: v }))}
                          onEnter={() => guardarFila(m)}
                        />
                        <SelectField
                          className="w-32 shrink-0 max-sm:w-full max-sm:basis-full"
                          ariaLabel="Categoría"
                          value={fila.cat}
                          onChange={(v) => setFila((f) => ({ ...f, cat: v }))}
                          options={opcionesCat(fila.type)}
                        />
                        <DateField
                          className="w-32 shrink-0 max-sm:w-auto max-sm:basis-[calc(50%-0.25rem)]"
                          ariaLabel="Fecha del movimiento"
                          value={fila.date}
                          onChange={(v) => setFila((f) => ({ ...f, date: v }))}
                        />
                        <div className="w-24 shrink-0 max-sm:w-auto max-sm:basis-[calc(50%-0.25rem)]">
                          <NumberField
                            compact
                            step={5}
                            ariaLabel="Importe"
                            value={fila.amount}
                            onChange={(v) => setFila((f) => ({ ...f, amount: v }))}
                            onEnter={() => guardarFila(m)}
                          />
                        </div>
                        {/* En móvil, botones a media fila y con texto: dos
                            iconos de 30px para confirmar una edición son poco. */}
                        <span className="flex shrink-0 gap-0.5 max-sm:basis-full max-sm:gap-2">
                          <button
                            type="button"
                            className={cn(btnIcon, 'max-sm:h-10 max-sm:flex-1 max-sm:gap-1.5 max-sm:text-sm max-sm:font-semibold')}
                            aria-label="Guardar"
                            disabled={pending}
                            onClick={() => guardarFila(m)}>
                            <Check className="size-4 text-success" />
                            <span className="sm:hidden">Guardar</span>
                          </button>
                          <button
                            type="button"
                            className={cn(btnIcon, 'max-sm:h-10 max-sm:flex-1 max-sm:gap-1.5 max-sm:text-sm max-sm:font-semibold')}
                            aria-label="Cancelar"
                            onClick={() => setEditando(null)}>
                            <X className="size-4" />
                            <span className="sm:hidden">Cancelar</span>
                          </button>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-11 shrink-0 text-[12px] tabular-nums text-muted-foreground">
                          {fmtDia(m.expenseDate)}
                        </span>
                        {/* En móvil el concepto solo tiene ~120px: antes se
                            cortaba ("Reparación del portáti…"), así que ahí se
                            reparte en dos líneas. Desde sm sobra el ancho. */}
                        <span className="min-w-0 flex-1 text-[13.5px] max-sm:line-clamp-2 sm:truncate">
                          {m.concept}
                        </span>
                        {/* En móvil solo el punto de color (con tooltip): la
                            categoría no se pierde y la fila sigue cabiendo. */}
                        <span
                          className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground sm:w-40"
                          title={`${esGasto ? 'Gasto' : 'Ingreso'} · ${cat?.name ?? 'Sin categoría'}`}>
                          <span
                            className="inline-block size-2 shrink-0 rounded-xs"
                            style={{ background: cat?.color ?? SIN_CATEGORIA }}
                          />
                          <span className="hidden min-w-0 truncate sm:block">{cat?.name ?? 'Sin categoría'}</span>
                        </span>
                        <span
                          className={cn(
                            'shrink-0 text-[13.5px] font-semibold tabular-nums sm:w-24 sm:text-right',
                            esGasto ? 'text-danger' : 'text-success',
                          )}>
                          {esGasto ? '−' : '+'}
                          {eur(m.amount)}
                        </span>
                        <span className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            className={btnIcon}
                            aria-label="Editar"
                            onClick={() => {
                              setConfirmando(null)
                              setFila({
                                type: m.type,
                                concept: m.concept,
                                amount: m.amount,
                                date: m.expenseDate,
                                cat: m.categoryUuid ?? '',
                              })
                              setEditando(m.uuid)
                            }}>
                            <Pencil className="size-3.5" />
                          </button>
                          {confirmando === m.uuid ? (
                            <>
                              <button
                                type="button"
                                className="rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white max-sm:px-3 max-sm:py-2"
                                onClick={() => {
                                  setConfirmando(null)
                                  run(deleteGasto(m.uuid), 'Movimiento eliminado')
                                }}>
                                Sí
                              </button>
                              <button type="button" className={btnIcon} aria-label="Cancelar" onClick={() => setConfirmando(null)}>
                                <X className="size-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={cn(btnIcon, 'hover:bg-danger-bg hover:text-danger')}
                              aria-label="Eliminar"
                              onClick={() => setConfirmando(m.uuid)}>
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                )
              })}

            </div>
          </div>

          {/* Topes: lo único de esta vista que avisa a tiempo */}
          <Topes topes={datos.topes} mes={datos.mes} />

          {/* Recurrentes: lo que va a caer solo */}
          <Recurrentes filas={recurrentes} mes={datos.mes} hoy={hoy} categorias={categorias} />

          {/* Los dos desgloses del mes */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Desglose
              titulo="En qué se va el dinero"
              centro="gastado"
              vacio="Sin gastos este mes."
              partes={datos.porCategoriaGasto}
            />
            <Desglose
              titulo="De dónde viene el dinero"
              centro="ingresado"
              vacio="Sin ingresos este mes."
              partes={datos.porCategoriaIngreso}
            />
          </div>
        </>
      )}

    </div>
  )
}

// ─────────── vista anual ───────────

function VistaAnio({ anio, onMes }: { anio: AnioMovimientos; onMes: (mes: number) => void }) {
  // Padding y texto más ajustados en móvil: así las cuatro columnas caben en
  // 375px y la tabla no necesita scroll horizontal.
  const thClass =
    'px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-3 sm:text-xs'
  const tdClass = 'px-2 py-2 text-[12.5px] sm:px-3 sm:text-sm'

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={`Ingresos de ${anio.year}`} valor={eur(anio.ingresos)} tono="success" />
        <Kpi label={`Gastos de ${anio.year}`} valor={eur(anio.gastos)} tono="danger" />
        <Kpi
          label="Balance del año"
          valor={eur(anio.balance)}
          tono={anio.balance >= 0 ? 'primary' : 'danger'}
          pie={anio.balance >= 0 ? 'te queda a favor' : 'has gastado más de lo que entró'}
        />
        <Kpi
          label="Gasto medio al mes"
          valor={eur(anio.gastoMedioMes)}
          pie="solo cuenta los meses con algo apuntado"
        />
      </div>

      {/* Cada una en su fila, a todo el ancho: la gráfica ya no depende de
          escalar un lienzo fijo (mide su hueco y pinta 1:1). */}
      <div className={cn(cardClass, 'mt-4 min-w-0')}>
        <h3 className="border-b border-border px-5 py-3 font-semibold">Mes a mes</h3>
        <div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className={thClass}>Mes</th>
                <th className={cn(thClass, 'text-right')}>Ingresos</th>
                <th className={cn(thClass, 'text-right')}>Gastos</th>
                <th className={cn(thClass, 'text-right')}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {anio.meses.map((m) => {
                const balance = m.ingresos - m.gastos
                const vacio = m.ingresos === 0 && m.gastos === 0
                return (
                  <tr key={m.mes} className="border-b border-border/50 last:border-0">
                    <td className={cn(tdClass, 'font-semibold')}>
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => onMes(m.mes)}>
                        <span className="sm:hidden">{mesCorto(m.mes - 1)}</span>
                        <span className="hidden sm:inline">{MESES[m.mes - 1]}</span>
                      </button>
                    </td>
                    <td className={cn(tdClass, 'text-right tabular-nums', vacio && 'text-muted-foreground/50')}>
                      {vacio ? '—' : eur(m.ingresos)}
                    </td>
                    <td className={cn(tdClass, 'text-right tabular-nums', vacio && 'text-muted-foreground/50')}>
                      {vacio ? '—' : eur(m.gastos)}
                    </td>
                    <td
                      className={cn(
                        tdClass,
                        'text-right font-semibold tabular-nums',
                        vacio ? 'text-muted-foreground/50' : balance >= 0 ? 'text-success' : 'text-danger',
                      )}>
                      {vacio ? '—' : eur(balance)}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-muted/50 font-semibold">
                <td className={tdClass}>TOTAL</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{eur(anio.ingresos)}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{eur(anio.gastos)}</td>
                <td
                  className={cn(
                    tdClass,
                    'text-right tabular-nums',
                    anio.balance >= 0 ? 'text-success' : 'text-danger',
                  )}>
                  {eur(anio.balance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Barras del año: ingresos y gastos por mes (SVG a mano, como el resto) */}
      <div className={cn(cardClass, 'mt-4 min-w-0')}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h3 className="font-semibold">Ingresos y gastos por mes</h3>
          <span className="text-[12.5px] text-muted-foreground">
            <span className="mr-1.5 inline-block size-2.5 rounded-xs bg-success align-middle" />Ingresos
            <span className="ml-3.5 mr-1.5 inline-block size-2.5 rounded-xs bg-danger align-middle" />Gastos
          </span>
        </div>
        <div className="px-4 py-3">
          <MovimientosPorMes meses={anio.meses} onMes={onMes} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Desglose
          titulo={`En qué se fue el dinero en ${anio.year}`}
          centro="gastado"
          vacio="Sin gastos este año."
          partes={anio.porCategoriaGasto}
        />
        <Desglose
          titulo={`De dónde vino el dinero en ${anio.year}`}
          centro="ingresado"
          vacio="Sin ingresos este año."
          partes={anio.porCategoriaIngreso}
        />
      </div>
    </div>
  )
}

/**
 * Barras de ingresos y gastos por mes, sobre Chart.js (componente portado del
 * proyecto de Inversiones). Exportada para los tests.
 */
export function MovimientosPorMes({
  meses,
  onMes,
}: {
  meses: Array<{ mes: number; ingresos: number; gastos: number }>
  /** Clic en la barra de un mes: lo abre, igual que su fila en la tabla. */
  onMes?: (mes: number) => void
}) {
  const c = coloresTema()
  return (
    <GraficaBarras
      labels={MESES.map((_, i) => mesCorto(i))}
      series={[
        {
          label: 'Ingresos',
          data: meses.map((m) => m.ingresos),
          backgroundColor: c.success,
          _unidad: 'eur',
        },
        {
          label: 'Gastos',
          data: meses.map((m) => m.gastos),
          backgroundColor: c.danger,
          _unidad: 'eur',
        },
      ]}
      alto={240}
      titulo={(i) => MESES[i]}
      scales={{ x: { ticks: ejeMeses }, y: { ticks: { callback: ejeEuros } } }}
      onBarra={onMes ? (i) => onMes(i + 1) : undefined}
    />
  )
}
