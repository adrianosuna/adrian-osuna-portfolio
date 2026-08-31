// Exportación a Excel de un año de ahorro (GET /app/finance/exportar?year=2026).
// Solo administrador (los route handlers no los protege el layout: guarda
// propia). Genera el .xlsx con exceljs: control mensual con restante y
// totales, ingresos extraordinarios, gastos de viajes y el resumen del año
// con la misma semántica de la app (sobrante de viajes incluido en el ahorro).
import ExcelJS from 'exceljs'
import { auth } from '@/auth'
import { getYearDetail } from '@/lib/finance'

import { MESES } from '@/lib/fechas'
const FMT_EUR = '#,##0 "€"'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return new Response('No autorizado', { status: 403 })
  }

  const year = Number(new URL(req.url).searchParams.get('year'))
  const detail = Number.isInteger(year) ? await getYearDetail(year) : null
  if (!detail) return new Response('Año no encontrado', { status: 404 })

  const libro = new ExcelJS.Workbook()
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

  const buffer = await libro.xlsx.writeBuffer()
  return new Response(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ahorro-${year}.xlsx"`,
      // Son las finanzas personales del admin: que ningún intermediario las
      // guarde. Caddy no cachea por defecto, pero esto lo deja cerrado.
      'Cache-Control': 'private, no-store',
    },
  })
}
