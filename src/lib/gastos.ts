// Capa de datos del control de gastos e ingresos (solo servidor). Réplica del
// Excel "Control de gastos": cada movimiento es un ingreso o un gasto con
// FECHA PROPIA (el mes se deriva de ella, no cuelga del año de ahorro), y cada
// mes tiene su resumen (ingresos, gastos, balance) y sus dos desgloses por
// categoría: en qué se va el dinero y de dónde viene.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { botonHtml, correoConfigurado, enviarCorreo, tarjetaHtml } from '@/lib/correo'
import { hoyMadrid } from '@/lib/mantenimiento'
import { SITE_URL } from '@/lib/site'
import { nombreMes } from '@/lib/fechas'
import { nivelTope, topesDelMes, UMBRAL_LIMITE, type TopeRow } from '@/lib/topes'
import { cargosPendientes, MAX_CARGOS, type RecurrenteRow } from '@/lib/recurrentes'

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
/** Date de columna DATE → 'YYYY-MM-DD' (las guardamos a medianoche UTC). */
const iso = (d: Date) => d.toISOString().slice(0, 10)

export type TipoMovimiento = 'INGRESO' | 'GASTO'

export interface CategoriaRow {
  uuid: string
  name: string
  type: TipoMovimiento
  color: string
  /** Nº de movimientos que la usan (para avisar al borrarla). */
  usos: number
  /** Nº de recurrentes que la usan: al borrar la categoría se quedan sin
   *  ella, y el aviso del borrado tiene que decirlo. */
  usosRecurrentes: number
  /** Tope de GASTO mensual (null = sin tope). Solo en las de gasto. */
  budget: number | null
}

export interface MovimientoRow {
  uuid: string
  type: TipoMovimiento
  concept: string
  amount: number
  expenseDate: string // 'YYYY-MM-DD'
  categoryUuid: string | null
}

/** Reparto por categoría de un tipo (el "desglose" del Excel). */
export interface ParteCategoria {
  uuid: string | null
  name: string
  color: string
  total: number
}

export interface MesMovimientos {
  /** 'YYYY-MM' */
  mes: string
  movimientos: MovimientoRow[]
  ingresos: number
  gastos: number
  /** ingresos − gastos. */
  balance: number
  /** Gasto medio al día del mes (gastos / días del mes). */
  gastoMedioDia: number
  /** Gastos e ingresos del mes anterior, para las comparativas. */
  gastosPrevios: number
  ingresosPrevios: number
  porCategoriaGasto: ParteCategoria[]
  porCategoriaIngreso: ParteCategoria[]
  /** Topes de las categorías de gasto que tengan uno, del más apurado al que
   *  más margen le queda. */
  topes: TopeRow[]
}

export interface MesResumen {
  mes: number // 1-12
  ingresos: number
  gastos: number
}

export interface AnioMovimientos {
  year: number
  meses: MesResumen[]
  ingresos: number
  gastos: number
  balance: number
  /** Gasto medio de los meses CON algún movimiento (como el Excel). */
  gastoMedioMes: number
  porCategoriaGasto: ParteCategoria[]
  porCategoriaIngreso: ParteCategoria[]
}

const SIN_CATEGORIA = '#94a3b8'

/** Primer día del mes siguiente a 'YYYY-MM' (límite superior exclusivo). */
const siguiente = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

const anterior = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

const rangoMes = (mes: string) => ({
  gte: new Date(`${mes}-01T00:00:00Z`),
  lt: new Date(`${siguiente(mes)}T00:00:00Z`),
})

const rangoAnio = (year: number) => ({
  gte: new Date(`${year}-01-01T00:00:00Z`),
  lt: new Date(`${year + 1}-01-01T00:00:00Z`),
})

/** Días del mes de un 'YYYY-MM'. */
const diasDelMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Reparto por categoría de los movimientos de un tipo, de mayor a menor. */
function desglose(
  movimientos: Array<{ type: TipoMovimiento; amount: number; categoryUuid: string | null }>,
  tipo: TipoMovimiento,
  categorias: CategoriaRow[],
): ParteCategoria[] {
  const porUuid = new Map<string | null, number>()
  for (const m of movimientos) {
    if (m.type !== tipo) continue
    porUuid.set(m.categoryUuid, (porUuid.get(m.categoryUuid) ?? 0) + m.amount)
  }
  return [...porUuid.entries()]
    .map(([uuid, total]) => {
      const cat = uuid === null ? undefined : categorias.find((c) => c.uuid === uuid)
      return { uuid, name: cat?.name ?? 'Sin categoría', color: cat?.color ?? SIN_CATEGORIA, total }
    })
    .sort((a, b) => b.total - a.total)
}

/** Categorías con sus usos (movimientos y recurrentes), por tipo y alfabéticas. */
export async function listCategorias(): Promise<CategoriaRow[]> {
  const [categorias, usos, usosRec] = await Promise.all([
    prisma.expenseCategory.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.expense.groupBy({ by: ['categoryUuid'], _count: { _all: true } }),
    prisma.recurringExpense.groupBy({ by: ['categoryUuid'], _count: { _all: true } }),
  ])
  const mapa = new Map(usos.map((u) => [u.categoryUuid, u._count._all]))
  const mapaRec = new Map(usosRec.map((u) => [u.categoryUuid, u._count._all]))
  return categorias.map((c) => ({
    uuid: c.uuid,
    name: c.name,
    type: c.type as TipoMovimiento,
    color: c.color,
    usos: mapa.get(c.uuid) ?? 0,
    usosRecurrentes: mapaRec.get(c.uuid) ?? 0,
    budget: c.budget === null ? null : num(c.budget),
  }))
}

/** Movimientos de un mes con su resumen y sus dos desgloses. */
export async function getMesMovimientos(
  mes: string,
  categorias: CategoriaRow[],
): Promise<MesMovimientos> {
  const [filas, previos] = await Promise.all([
    prisma.expense.findMany({
      where: { expenseDate: rangoMes(mes) },
      orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
    }),
    prisma.expense.groupBy({
      by: ['type'],
      where: { expenseDate: rangoMes(anterior(mes)) },
      _sum: { amount: true },
    }),
  ])

  const movimientos: MovimientoRow[] = filas.map((m) => ({
    uuid: m.uuid,
    type: m.type as TipoMovimiento,
    concept: m.concept,
    amount: num(m.amount),
    expenseDate: m.expenseDate.toISOString().slice(0, 10),
    categoryUuid: m.categoryUuid,
  }))

  const suma = (tipo: TipoMovimiento) =>
    movimientos.filter((m) => m.type === tipo).reduce((s, m) => s + m.amount, 0)
  const ingresos = suma('INGRESO')
  const gastos = suma('GASTO')
  const previo = (tipo: TipoMovimiento) =>
    num(previos.find((p) => p.type === tipo)?._sum.amount)

  return {
    mes,
    movimientos,
    ingresos,
    gastos,
    balance: ingresos - gastos,
    gastoMedioDia: gastos / diasDelMes(mes),
    gastosPrevios: previo('GASTO'),
    ingresosPrevios: previo('INGRESO'),
    porCategoriaGasto: desglose(movimientos, 'GASTO', categorias),
    porCategoriaIngreso: desglose(movimientos, 'INGRESO', categorias),
    topes: topesDelMes(categorias, movimientos),
  }
}

/** Resumen anual: mes a mes (ingresos/gastos/balance) y desgloses del año. */
export async function getAnioMovimientos(
  year: number,
  categorias: CategoriaRow[],
): Promise<AnioMovimientos> {
  const filas = await prisma.expense.findMany({
    where: { expenseDate: rangoAnio(year) },
    select: { type: true, amount: true, expenseDate: true, categoryUuid: true },
  })

  const movimientos = filas.map((m) => ({
    type: m.type as TipoMovimiento,
    amount: num(m.amount),
    categoryUuid: m.categoryUuid,
    mes: m.expenseDate.getUTCMonth() + 1,
  }))

  const meses: MesResumen[] = Array.from({ length: 12 }, (_, i) => {
    const delMes = movimientos.filter((m) => m.mes === i + 1)
    return {
      mes: i + 1,
      ingresos: delMes.filter((m) => m.type === 'INGRESO').reduce((s, m) => s + m.amount, 0),
      gastos: delMes.filter((m) => m.type === 'GASTO').reduce((s, m) => s + m.amount, 0),
    }
  })

  const ingresos = meses.reduce((s, m) => s + m.ingresos, 0)
  const gastos = meses.reduce((s, m) => s + m.gastos, 0)
  // Como el Excel: la media solo cuenta los meses en los que hay algo apuntado.
  const conMovimiento = meses.filter((m) => m.ingresos > 0 || m.gastos > 0).length

  return {
    year,
    meses,
    ingresos,
    gastos,
    balance: ingresos - gastos,
    gastoMedioMes: conMovimiento ? gastos / conMovimiento : 0,
    porCategoriaGasto: desglose(movimientos, 'GASTO', categorias),
    porCategoriaIngreso: desglose(movimientos, 'INGRESO', categorias),
  }
}

// ─────────── movimientos recurrentes ───────────

/** Todos los recurrentes, los activos primero y por fecha del próximo cargo. */
export async function listRecurrentes(): Promise<RecurrenteRow[]> {
  const [filas, generados] = await Promise.all([
    prisma.recurringExpense.findMany({ orderBy: [{ active: 'desc' }, { nextDate: 'asc' }] }),
    // Cuántos movimientos ha apuntado cada uno (los que siguen existiendo).
    prisma.expense.groupBy({
      by: ['recurringUuid'],
      where: { recurringUuid: { not: null } },
      _count: { _all: true },
    }),
  ])
  const cuenta = new Map(generados.map((g) => [g.recurringUuid, g._count._all]))
  return filas.map((r) => ({
    uuid: r.uuid,
    type: r.type as TipoMovimiento,
    concept: r.concept,
    amount: num(r.amount),
    intervalMonths: r.intervalMonths,
    nextDate: iso(r.nextDate),
    dayAnchor: r.dayAnchor,
    active: r.active,
    lastCreated: r.lastCreated === null ? null : iso(r.lastCreated),
    categoryUuid: r.categoryUuid,
    generados: cuenta.get(r.uuid) ?? 0,
  }))
}

/**
 * Apunta los movimientos recurrentes que ya han vencido y adelanta su próxima
 * fecha. La ejecuta el cron diario ANTES de los avisos, para que el aviso de
 * topes cuente ya con el alquiler del día 1.
 *
 * Devuelve cuántos movimientos ha creado. Es idempotente dentro del día: al
 * adelantar `next_date` después de crear, una segunda pasada no duplica nada.
 */
export async function generarRecurrentes(hoyIso = hoyMadrid()): Promise<number> {
  const vencidos = await prisma.recurringExpense.findMany({
    where: { active: true, nextDate: { lte: new Date(`${hoyIso}T00:00:00Z`) } },
  })
  if (!vencidos.length) return 0

  let creados = 0
  for (const r of vencidos) creados += await apuntarCargos(r, hoyIso)
  return creados
}

/** Fila de recurrente que necesita `apuntarCargos` (lo que devuelve Prisma). */
type FilaRecurrente = {
  uuid: string
  type: string
  concept: string
  amount: unknown
  intervalMonths: number
  nextDate: Date
  dayAnchor: number
  categoryUuid: string | null
}

/**
 * Apunta los cargos de UN recurrente hasta `hastaIso` y adelanta su fecha.
 * Devuelve cuántos movimientos ha creado.
 *
 * Lo comparten el cron (que pasa el día de hoy) y el botón "Apuntar ahora" de
 * la sección Ajustes (que pasa la propia fecha del cargo, para no esperar a
 * que venza). Que sea la misma rutina es lo que garantiza que apuntar a mano y
 * dejar que lo haga el cron produzcan exactamente lo mismo.
 */
async function apuntarCargos(r: FilaRecurrente, hastaIso: string): Promise<number> {
  const { fechas, siguiente, truncado } = cargosPendientes(
    { nextDate: iso(r.nextDate), intervalMonths: r.intervalMonths, dayAnchor: r.dayAnchor },
    hastaIso,
  )
  if (!fechas.length) return 0
  if (truncado) {
    console.warn(
      `[recurrentes] "${r.concept}" acumulaba más de ${MAX_CARGOS} cargos: se apuntan los ${MAX_CARGOS} primeros y salta a ${siguiente}`,
    )
  }

  // Movimientos y adelanto de la fecha, en la misma transacción: si algo
  // falla, el recurrente no se queda "cobrado" sin sus movimientos.
  await prisma.$transaction([
    prisma.expense.createMany({
      data: fechas.map((f) => ({
        type: r.type as TipoMovimiento,
        concept: r.concept,
        amount: r.amount as number,
        expenseDate: new Date(`${f}T00:00:00Z`),
        categoryUuid: r.categoryUuid,
        // Origen: es lo que permite ver después qué ha apuntado cada uno.
        recurringUuid: r.uuid,
      })),
    }),
    prisma.recurringExpense.update({
      where: { uuid: r.uuid },
      data: {
        nextDate: new Date(`${siguiente}T00:00:00Z`),
        lastCreated: new Date(`${fechas[fechas.length - 1]}T00:00:00Z`),
      },
    }),
  ])
  return fechas.length
}

/**
 * Apunta YA el cargo de un recurrente, sin esperar al cron.
 *
 * Apunta el cargo de su propia fecha (y todos los atrasados, si los hubiera) y
 * adelanta `next_date`, exactamente lo que haría el cron: así no se duplica
 * cuando llegue el día. Vale también con el recurrente en pausa — es una acción
 * manual y deliberada — y no lo reactiva.
 *
 * Devuelve cuántos movimientos ha apuntado y hasta qué fecha.
 */
export async function apuntarRecurrenteYa(
  uuid: string,
  hoyIso = hoyMadrid(),
): Promise<{ creados: number; hasta: string } | null> {
  const r = await prisma.recurringExpense.findUnique({ where: { uuid } })
  if (!r) return null
  // Si aún no ha vencido, el "hasta" es su propia fecha: se apunta ese cargo y
  // ninguno más. Si ya venció, se recuperan todos los pendientes como el cron.
  const suya = iso(r.nextDate)
  const hasta = suya > hoyIso ? suya : hoyIso
  return { creados: await apuntarCargos(r, hasta), hasta }
}

/** Movimientos que ha generado un recurrente, del más reciente al más antiguo. */
export async function movimientosDeRecurrente(
  uuid: string,
  limite = 12,
): Promise<{ total: number; movimientos: MovimientoRow[] }> {
  const [total, filas] = await Promise.all([
    prisma.expense.count({ where: { recurringUuid: uuid } }),
    prisma.expense.findMany({
      where: { recurringUuid: uuid },
      orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
      take: limite,
    }),
  ])
  return {
    total,
    movimientos: filas.map((m) => ({
      uuid: m.uuid,
      type: m.type as TipoMovimiento,
      concept: m.concept,
      amount: num(m.amount),
      expenseDate: iso(m.expenseDate),
      categoryUuid: m.categoryUuid,
    })),
  }
}

// ─────────── aviso de topes (cron diario) ───────────

/** Importe en euros para el correo (sin decimales, como el resto de avisos). */
const eurTexto = (v: number) =>
  `${v.toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })} €`

/** Topes del mes en curso con su gasto, para el aviso. */
async function topesDeHoy(mes: string): Promise<TopeRow[]> {
  const [categorias, gastos] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { type: 'GASTO', budget: { not: null } } }),
    prisma.expense.groupBy({
      by: ['categoryUuid'],
      where: { type: 'GASTO', expenseDate: rangoMes(mes) },
      _sum: { amount: true },
    }),
  ])
  // topesDelMes espera movimientos: el groupBy ya viene sumado, así que cada
  // categoría entra como un movimiento con su total.
  return topesDelMes(
    categorias.map((c) => ({
      uuid: c.uuid,
      name: c.name,
      color: c.color,
      type: 'GASTO' as const,
      budget: c.budget === null ? null : num(c.budget),
    })),
    gastos.map((g) => ({
      type: 'GASTO' as const,
      amount: num(g._sum.amount),
      categoryUuid: g.categoryUuid,
    })),
  )
}

/**
 * Avisa por correo de los topes de gasto alcanzados en el mes en curso.
 *
 * A diferencia del resto de avisos, este **no se repite semanalmente**: manda
 * un correo por mes y por nivel alcanzado (80 % y 100 %), y lo recuerda en
 * `expense_category.budget_notified` como 'YYYY-MM:nivel'. El motivo es que un
 * gasto ya hecho no se puede "marcar como hecho": insistir cada semana solo
 * enseñaría a ignorar el aviso. Al cambiar de mes la clave deja de coincidir y
 * los topes vuelven a avisar solos.
 *
 * Devuelve cuántas categorías se han avisado.
 */
export async function avisarTopes(hoyIso = hoyMadrid()): Promise<number> {
  if (!correoConfigurado()) return 0
  const mes = hoyIso.slice(0, 7)
  const topes = await topesDeHoy(mes)
  if (!topes.length) return 0

  const marcas = await prisma.expenseCategory.findMany({
    where: { uuid: { in: topes.map((t) => t.uuid) } },
    select: { uuid: true, notified: true },
  })
  const previa = new Map(marcas.map((m) => [m.uuid, m.notified]))

  const claveDe = (t: TopeRow) => `${mes}:${nivelTope(t.pct)}`
  const nuevos = topes.filter(
    (t) => nivelTope(t.pct) !== 'ok' && previa.get(t.uuid) !== claveDe(t),
  )

  // Un tope que ha vuelto a "ok" (porque se subió el límite) limpia su marca:
  // si más adelante se vuelve a cruzar en el mismo mes, tiene que avisar.
  const recuperados = topes.filter(
    (t) => nivelTope(t.pct) === 'ok' && previa.get(t.uuid) !== null,
  )
  if (recuperados.length) {
    await prisma.expenseCategory.updateMany({
      where: { uuid: { in: recuperados.map((t) => t.uuid) } },
      data: { notified: null },
    })
  }

  if (!nuevos.length) return 0

  const pasados = nuevos.filter((t) => nivelTope(t.pct) === 'pasado')
  const alLimite = nuevos.filter((t) => nivelTope(t.pct) === 'limite')
  const trozos = [
    pasados.length ? `${pasados.length} ${pasados.length === 1 ? 'pasado' : 'pasados'}` : '',
    alLimite.length ? `${alLimite.length} al límite` : '',
  ].filter(Boolean)

  const tarjetas = nuevos
    .map((t) =>
      tarjetaHtml(
        t.name,
        `${eurTexto(t.gastado)} de ${eurTexto(t.budget)} — ${Math.round(t.pct)}&nbsp;% del tope`,
        nivelTope(t.pct) === 'pasado'
          ? `Te has pasado en ${eurTexto(t.gastado - t.budget)}`
          : `Te quedan ${eurTexto(t.budget - t.gastado)}`,
        nivelTope(t.pct) === 'pasado',
      ),
    )
    .join('')

  await enviarCorreo(
    `⚠ Topes de ${nombreMes(Number(mes.slice(5, 7)))}: ${trozos.join(' y ')}`,
    `<p style="margin:0 0 14px">Vas por aquí en los topes de gasto que te has puesto este mes:</p>
     ${tarjetas}
     ${botonHtml('Abrir Gastos', `${SITE_URL}/app/finance?s=gastos&mes=${mes}`)}
     <p style="margin:14px 0 0;font-size:12px;color:#64766f">Cada tope avisa una vez al llegar al
     ${UMBRAL_LIMITE}&nbsp;% y otra al pasarse; no se repite. El mes que viene empieza de cero.</p>`,
  )

  // Una escritura por nivel: la clave guardada es la que evita repetir el aviso.
  await Promise.all(
    [
      { nivel: 'pasado', lista: pasados },
      { nivel: 'limite', lista: alLimite },
    ]
      .filter((g) => g.lista.length)
      .map((g) =>
        prisma.expenseCategory.updateMany({
          where: { uuid: { in: g.lista.map((t) => t.uuid) } },
          data: { notified: `${mes}:${g.nivel}` },
        }),
      ),
  )
  return nuevos.length
}

/** Gastos del mes de una fecha ISO (tarjeta del inicio del dashboard). */
export async function gastadoEnMesDe(hoyIso: string): Promise<number> {
  const suma = await prisma.expense.aggregate({
    where: { type: 'GASTO', expenseDate: rangoMes(hoyIso.slice(0, 7)) },
    _sum: { amount: true },
  })
  return num(suma._sum.amount)
}
