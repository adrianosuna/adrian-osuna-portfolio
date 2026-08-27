// Capa de datos del control de gastos e ingresos (solo servidor). Réplica del
// Excel "Control de gastos": cada movimiento es un ingreso o un gasto con
// FECHA PROPIA (el mes se deriva de ella, no cuelga del año de ahorro), y cada
// mes tiene su resumen (ingresos, gastos, balance) y sus dos desgloses por
// categoría: en qué se va el dinero y de dónde viene.
import 'server-only'
import { prisma } from '@/lib/prisma'

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))

export type TipoMovimiento = 'INGRESO' | 'GASTO'

export interface CategoriaRow {
  uuid: string
  name: string
  type: TipoMovimiento
  color: string
  /** Nº de movimientos que la usan (para avisar al borrarla). */
  usos: number
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

/** Categorías con su número de usos, por tipo y alfabéticas. */
export async function listCategorias(): Promise<CategoriaRow[]> {
  const [categorias, usos] = await Promise.all([
    prisma.expenseCategory.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    prisma.expense.groupBy({ by: ['categoryUuid'], _count: { _all: true } }),
  ])
  const mapa = new Map(usos.map((u) => [u.categoryUuid, u._count._all]))
  return categorias.map((c) => ({
    uuid: c.uuid,
    name: c.name,
    type: c.type as TipoMovimiento,
    color: c.color,
    usos: mapa.get(c.uuid) ?? 0,
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

/** Gastos del mes de una fecha ISO (tarjeta del inicio del dashboard). */
export async function gastadoEnMesDe(hoyIso: string): Promise<number> {
  const suma = await prisma.expense.aggregate({
    where: { type: 'GASTO', expenseDate: rangoMes(hoyIso.slice(0, 7)) },
    _sum: { amount: true },
  })
  return num(suma._sum.amount)
}
