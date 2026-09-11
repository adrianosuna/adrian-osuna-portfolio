// Exportación a Excel de Finanzas. Dos modos sobre el mismo endpoint:
//
//   · `?year=2026` — un año de ahorro, como siempre.
//   · `?todo=1`    — TODO el módulo: el resumen histórico, una hoja por año,
//                    todos los movimientos, las categorías y los recurrentes.
//
// El modo global existe porque hasta ahora el dato solo salía año a año, y lo
// que se quería es tenerlo FUERA de la aplicación en un formato que se pueda
// abrir sin ella. No sustituye al backup de la BD: aquel sirve para restaurar,
// este para leer.
//
// Solo administrador (los route handlers no los protege el layout: guarda
// propia).
import ExcelJS from 'exceljs'
import { auth } from '@/auth'
import { getYearDetail, listYears, type YearDetail } from '@/lib/finance'
import { listCategorias, listRecurrentes, todosLosMovimientos } from '@/lib/gastos'
import { etiquetaPeriodo } from '@/lib/recurrentes'
import { esGrupo } from '@/lib/categorias'

import { MESES } from '@/lib/fechas'
const FMT_EUR = '#,##0 "€"'
/** Los movimientos sí llevan céntimos: son el dato de origen, no un KPI. */
const FMT_EUR_CENT = '#,##0.00 "€"'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return new Response('No autorizado', { status: 403 })
  }

  const params = new URL(req.url).searchParams
  if (params.get('todo') === '1') return exportarTodo()

  const year = Number(params.get('year'))
  const detail = Number.isInteger(year) ? await getYearDetail(year) : null
  if (!detail) return new Response('Año no encontrado', { status: 404 })

  const libro = new ExcelJS.Workbook()
  hojaDeAnio(libro, detail)
  return responder(libro, `ahorro-${year}.xlsx`)
}

/** Cabeceras comunes de las dos descargas. */
async function responder(libro: ExcelJS.Workbook, nombre: string) {
  const buffer = await libro.xlsx.writeBuffer()
  return new Response(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      // Son las finanzas personales del admin: que ningún intermediario las
      // guarde. Caddy no cachea por defecto, pero esto lo deja cerrado.
      'Cache-Control': 'private, no-store',
    },
  })
}

/** La hoja de un año de ahorro: la de siempre, extraída para reutilizarla. */
function hojaDeAnio(libro: ExcelJS.Workbook, detail: YearDetail) {
  const year = detail.year.year
  const hoja = libro.addWorksheet(`Ahorro ${year}`)
  hoja.columns = [
    { width: 22 }, { width: 14 }, { width: 15 }, { width: 14 }, { width: 18 },
  ]

  const negrita = (fila: ExcelJS.Row) => (fila.font = { bold: true })
  const euros = (fila: ExcelJS.Row, columnas: number[]) =>
    columnas.forEach((c) => (fila.getCell(c).numFmt = FMT_EUR))

  // ── Control mensual ──
  negrita(hoja.addRow(['Mes', 'Ingreso', 'Ahorro general', 'Ahorro viajes', 'Restante uso diario']))
  let totIngresos = 0
  let totGeneral = 0
  let totViajes = 0
  for (let m = 1; m <= 12; m++) {
    const fila = detail.months.find((x) => x.month === m)
    const restante =
      fila?.income === null || fila?.income === undefined
        ? null
        : fila.income - (fila.savingGeneral || 0) - (fila.savingTravel || 0)
    totIngresos += fila?.income || 0
    totGeneral += fila?.savingGeneral || 0
    totViajes += fila?.savingTravel || 0
    const r = hoja.addRow([
      MESES[m - 1],
      fila?.income ?? null,
      fila?.savingGeneral ?? null,
      fila?.savingTravel ?? null,
      restante,
    ])
    euros(r, [2, 3, 4, 5])
  }
  const totales = hoja.addRow(['TOTALES', totIngresos, totGeneral, totViajes, totIngresos - totGeneral - totViajes])
  negrita(totales)
  euros(totales, [2, 3, 4, 5])

  // ── Ingresos extraordinarios ──
  hoja.addRow([])
  negrita(hoja.addRow(['Ingresos extraordinarios', 'Importe']))
  const extrasTotal = detail.extras.reduce((s, e) => s + e.amount, 0)
  for (const e of detail.extras) euros(hoja.addRow([e.concept, e.amount]), [2])
  const filaExtras = hoja.addRow(['Total extras', extrasTotal])
  negrita(filaExtras)
  euros(filaExtras, [2])

  // ── Gastos de viajes ──
  hoja.addRow([])
  negrita(hoja.addRow(['Gastos de viajes', 'Importe']))
  const gastadoViajes = detail.travels.reduce((s, t) => s + t.amount, 0)
  for (const t of detail.travels) euros(hoja.addRow([t.concept, t.amount]), [2])
  const filaViajes = hoja.addRow(['Total gastado', gastadoViajes])
  negrita(filaViajes)
  euros(filaViajes, [2])

  // ── Resumen del año (misma semántica que la app) ──
  const sobrante = totViajes - gastadoViajes
  const ahorroAnual = totGeneral + extrasTotal + sobrante
  hoja.addRow([])
  negrita(hoja.addRow([`Resumen ${year}`]))
  const resumen: Array<[string, number | string | null]> = [
    ['Ingresos del año', totIngresos],
    ['Ahorro mensual', totGeneral],
    ['Ingresos extraordinarios', extrasTotal],
    ['Sobrante de viajes', sobrante],
    ['Ahorro anual', ahorroAnual],
    ['Objetivo', detail.year.goal],
    ['Tasa de ahorro', totIngresos > 0 ? `${Math.round((ahorroAnual / totIngresos) * 100)}%` : '—'],
  ]
  for (const [etiqueta, valor] of resumen) {
    const r = hoja.addRow([etiqueta, valor])
    if (typeof valor === 'number') euros(r, [2])
  }
}

/**
 * TODO el módulo en un solo libro.
 *
 * El orden de las hojas es el de lectura, no el de las consultas: primero el
 * resumen (para situarse), después un año por hoja, y al final los datos de
 * origen —movimientos, categorías, recurrentes— que son los que se filtran y
 * se cruzan en una hoja de cálculo.
 */
async function exportarTodo() {
  const [anios, movimientos, categorias, recurrentes] = await Promise.all([
    listYears(),
    todosLosMovimientos(),
    listCategorias(),
    listRecurrentes(),
  ])

  const libro = new ExcelJS.Workbook()
  const negrita = (fila: ExcelJS.Row) => (fila.font = { bold: true })
  const euros = (fila: ExcelJS.Row, columnas: number[], fmt = FMT_EUR) =>
    columnas.forEach((c) => (fila.getCell(c).numFmt = fmt))

  // ── Resumen histórico ──
  const res = libro.addWorksheet('Resumen')
  res.columns = [{ width: 10 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }]
  negrita(res.addRow(['Año', 'Ingresos', 'Ahorro mensual', 'Extras', 'Sobrante viajes', 'Objetivo']))
  for (const a of anios) {
    const sobrante = a.monthsTravel - a.travelsTotal
    const fila = res.addRow([
      a.year, a.incomeTotal, a.monthsGeneral, a.extrasTotal, sobrante, a.goal,
    ])
    euros(fila, [2, 3, 4, 5, 6])
  }

  // ── Una hoja por año, con el mismo detalle que la exportación de un año ──
  // En serie y no en paralelo: `getYearDetail` son cuatro consultas por año, y
  // lanzarlas todas de golpe no gana nada frente a un puñado de años.
  for (const a of anios) {
    const detail = await getYearDetail(a.year)
    if (detail) hojaDeAnio(libro, detail)
  }

  // ── Movimientos: el dato de origen de Gastos ──
  const mov = libro.addWorksheet('Movimientos')
  mov.columns = [
    { width: 12 }, { width: 10 }, { width: 34 }, { width: 26 }, { width: 14 },
    { width: 12 }, { width: 40 },
  ]
  negrita(mov.addRow(['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Importe', 'Recurrente', 'Nota']))
  for (const m of movimientos) {
    const fila = mov.addRow([
      m.expenseDate,
      m.type === 'GASTO' ? 'Gasto' : 'Ingreso',
      m.concept,
      m.categoria,
      m.amount,
      m.deRecurrente ? 'sí' : '',
      m.note ?? '',
    ])
    euros(fila, [5], FMT_EUR_CENT)
  }
  mov.autoFilter = { from: 'A1', to: `G1` }

  // ── Categorías, en orden de árbol y diciendo qué es cada fila ──
  const cat = libro.addWorksheet('Categorías')
  cat.columns = [{ width: 26 }, { width: 20 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 12 }]
  negrita(cat.addRow(['Nombre', 'Grupo', 'Tipo', 'Qué es', 'Tope', 'Movimientos']))
  for (const c of categorias) {
    const fila = cat.addRow([
      c.name,
      c.parentName ?? '',
      c.type === 'GASTO' ? 'Gasto' : 'Ingreso',
      esGrupo(c) ? 'Grupo' : 'Categoría',
      c.budget,
      c.usos,
    ])
    euros(fila, [5])
  }

  // ── Recurrentes ──
  const rec = libro.addWorksheet('Recurrentes')
  rec.columns = [{ width: 30 }, { width: 10 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 12 }]
  negrita(rec.addRow(['Concepto', 'Tipo', 'Importe', 'Periodicidad', 'Próximo cargo', 'Estado']))
  for (const r of recurrentes) {
    const fila = rec.addRow([
      r.concept,
      r.type === 'GASTO' ? 'Gasto' : 'Ingreso',
      r.amount,
      etiquetaPeriodo(r.intervalMonths),
      r.nextDate,
      r.active ? 'Activo' : 'En pausa',
    ])
    euros(fila, [3], FMT_EUR_CENT)
  }

  const hoy = new Date().toISOString().slice(0, 10)
  return responder(libro, `finanzas-${hoy}.xlsx`)
}
