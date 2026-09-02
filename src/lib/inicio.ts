// Datos del inicio del dashboard (solo servidor): lo que requiere atención
// hoy, los KPIs con dato real y la actividad reciente. Todo en una pasada
// paralela de consultas acotadas — el inicio no debe pagar el precio de
// traerse módulos enteros para pintar cuatro cifras.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { mesesSinRellenar } from '@/lib/finance'
import { gastadoEnMesDe } from '@/lib/gastos'
import { estadoDe, hoyMadrid } from '@/lib/mantenimiento'
import { metricasPipeline } from '@/lib/pipeline'

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))

import { MESES } from '@/lib/fechas'

/** Aviso accionable de la franja "Requiere tu atención". */
export interface Aviso {
  clave: string
  texto: string
  detalle: string
  /** urgente = ya vencido; aviso = conviene mirarlo. */
  gravedad: 'urgente' | 'aviso'
  href: string
}

export interface ActividadItem {
  uuid: string
  oportunidad: string
  tipo: string
  detalle: string
  cuando: string // ISO
}

export interface ResumenInicio {
  avisos: Aviso[]
  ahorro: { year: number; total: number; goal: number | null } | null
  /** Gastado en el mes en curso (control de gastos). */
  gastadoMes: number
  /** Gastado en el mes anterior, para la comparativa del KPI. */
  gastadoMesPrevio: number
  pipeline: { abiertas: number; valorAbierto: number }
  actividad: ActividadItem[]
}

/** Todo lo que necesita el inicio, en cuatro consultas paralelas. */
export async function resumenInicio(hoyIso = hoyMadrid()): Promise<ResumenInicio> {
  const year = Number(hoyIso.slice(0, 4))
  const mesActual = Number(hoyIso.slice(5, 7))
  // Primer día del mes anterior (cruzando de año), para su gasto comparado.
  const mesPrevioIso = `${mesActual === 1 ? year - 1 : year}-${String(
    mesActual === 1 ? 12 : mesActual - 1,
  ).padStart(2, '0')}-01`

  const [anio, oportunidades, tareas, eventos, gastadoMes, gastadoMesPrevio] = await Promise.all([
    // Solo el año en curso (no todos, como hacía el inicio anterior).
    prisma.savingYear.findUnique({
      where: { year },
      select: {
        goal: true,
        months: { select: { month: true, income: true, savingGeneral: true, savingTravel: true } },
        extras: { select: { amount: true } },
        travelExpenses: { select: { amount: true } },
      },
    }),
    prisma.opportunity.findMany({
      where: { archived: false },
      select: { uuid: true, title: true, status: true, amount: true, createTs: true, closedAt: true, nextAction: true, nextActionDate: true },
    }),
    prisma.maintenanceTask.findMany({ select: { title: true, nextDue: true } }),
    prisma.opportunityEvent.findMany({
      take: 5,
      orderBy: [{ createTs: 'desc' }, { id: 'desc' }],
      select: { uuid: true, type: true, detail: true, createTs: true, opportunity: { select: { title: true } } },
    }),
    gastadoEnMesDe(hoyIso),
    gastadoEnMesDe(mesPrevioIso),
  ])

  // ── Ahorro del año en curso (misma semántica que el módulo) ──
  const ahorro = anio
    ? {
        year,
        goal: anio.goal === null ? null : num(anio.goal),
        total:
          anio.months.reduce((s, m) => s + num(m.savingGeneral), 0) +
          anio.extras.reduce((s, e) => s + num(e.amount), 0) +
          (anio.months.reduce((s, m) => s + num(m.savingTravel), 0) -
            anio.travelExpenses.reduce((s, t) => s + num(t.amount), 0)),
      }
    : null

  // ── Métricas del pipeline (solo lo vivo: el inicio no archiva historia) ──
  const metricas = metricasPipeline(
    oportunidades.map((o) => ({
      status: o.status,
      amount: o.amount === null ? null : num(o.amount),
      createTs: o.createTs,
      closedAt: o.closedAt,
    })),
  )

  return {
    // Urgentes primero, manteniendo el orden de detección dentro de cada nivel.
    avisos: construirAvisos({ oportunidades, tareas, meses: anio?.months ?? null, year, mesActual, hoyIso }),
    ahorro,
    gastadoMes,
    gastadoMesPrevio,
    pipeline: { abiertas: metricas.abiertas, valorAbierto: metricas.valorAbierto },
    actividad: eventos.map((e) => ({
      uuid: e.uuid,
      oportunidad: e.opportunity.title,
      tipo: e.type,
      detalle: e.detail,
      cuando: e.createTs.toISOString(),
    })),
  }
}

// ─────────── avisos ───────────
// La construcción de los avisos es PURA y vive aparte porque la comparten dos
// consumidores: el inicio (que ya tiene los datos a mano de sus propios KPIs) y
// el centro de notificaciones de la barra superior (que consulta solo esto).
// Duplicar los criterios es justo cómo se desincronizan las dos campanas.

interface DatosAvisos {
  oportunidades: Array<{
    title: string
    status: string
    nextAction: string | null
    nextActionDate: Date | null
  }>
  tareas: Array<{ title: string; nextDue: Date }>
  /** Meses del año en curso (null si ese año no existe). */
  meses: Array<{
    month: number; income: unknown; savingGeneral: unknown; savingTravel: unknown
  }> | null
  year: number
  mesActual: number
  hoyIso: string
}

function construirAvisos({
  oportunidades, tareas, meses, year, mesActual, hoyIso,
}: DatosAvisos): Aviso[] {
  const avisos: Aviso[] = []

  const seguimientos = oportunidades.filter(
    (o) =>
      o.nextActionDate !== null &&
      ['CONTACTO', 'CONVERSACION', 'PROPUESTA'].includes(o.status) &&
      o.nextActionDate.toISOString().slice(0, 10) <= hoyIso,
  )
  if (seguimientos.length) {
    avisos.push({
      clave: 'seguimientos',
      texto:
        seguimientos.length === 1
          ? 'Un seguimiento del pipeline vencido'
          : `${seguimientos.length} seguimientos del pipeline vencidos`,
      detalle:
        seguimientos.length === 1
          ? (seguimientos[0].nextAction ?? seguimientos[0].title)
          : seguimientos.map((s) => s.title).slice(0, 3).join(' · '),
      gravedad: 'urgente',
      href: '/app/pipeline',
    })
  }

  const vencidas = tareas.filter((t) => estadoDe(t.nextDue.toISOString().slice(0, 10), hoyIso) === 'vencida')
  const proximas = tareas.filter((t) => estadoDe(t.nextDue.toISOString().slice(0, 10), hoyIso) === 'proxima')
  if (vencidas.length) {
    avisos.push({
      clave: 'mantenimiento-vencido',
      texto: vencidas.length === 1 ? 'Una tarea de mantenimiento vencida' : `${vencidas.length} tareas de mantenimiento vencidas`,
      detalle: vencidas.map((t) => t.title).slice(0, 2).join(' · '),
      gravedad: 'urgente',
      href: '/app/panel?tab=mantenimiento',
    })
  } else if (proximas.length) {
    avisos.push({
      clave: 'mantenimiento-proximo',
      texto: proximas.length === 1 ? 'Una tarea de mantenimiento esta semana' : `${proximas.length} tareas de mantenimiento esta semana`,
      detalle: proximas.map((t) => t.title).slice(0, 2).join(' · '),
      gravedad: 'aviso',
      href: '/app/panel?tab=mantenimiento',
    })
  }

  // Meses de ahorro ya cerrados sin ningún dato (el mes en curso no cuenta).
  if (meses) {
    const vacios = mesesSinRellenar(meses, mesActual - 1)
    if (vacios.length) {
      avisos.push({
        clave: 'ahorro-sin-rellenar',
        texto:
          vacios.length === 1
            ? `${MESES[vacios[0] - 1]} sin rellenar en el ahorro`
            : `${vacios.length} meses sin rellenar en el ahorro`,
        detalle: vacios.map((m) => MESES[m - 1]).join(', '),
        gravedad: 'aviso',
        href: `/app/finance?s=ahorro&year=${year}`,
      })
    }
  }

  // Urgentes primero, manteniendo el orden de detección dentro de cada nivel.
  return avisos.sort((a, b) => Number(b.gravedad === 'urgente') - Number(a.gravedad === 'urgente'))
}

/**
 * Solo los avisos, con sus propias consultas acotadas.
 *
 * Lo usa el centro de notificaciones de la barra superior, que está en TODAS
 * las páginas del dashboard: por eso consulta lo mínimo (tres selects con los
 * campos justos) y no el resumen completo del inicio.
 */
export async function avisosPendientes(hoyIso = hoyMadrid()): Promise<Aviso[]> {
  const year = Number(hoyIso.slice(0, 4))
  const mesActual = Number(hoyIso.slice(5, 7))
  const [oportunidades, tareas, anio] = await Promise.all([
    prisma.opportunity.findMany({
      where: { archived: false },
      select: { title: true, status: true, nextAction: true, nextActionDate: true },
    }),
    prisma.maintenanceTask.findMany({ select: { title: true, nextDue: true } }),
    prisma.savingYear.findUnique({
      where: { year },
      select: {
        months: {
          // Los tres campos: un mes "relleno" es el que tiene ALGUNO (lo decide
          // `mesesSinRellenar`, compartida con el aviso por correo).
          select: { month: true, income: true, savingGeneral: true, savingTravel: true },
        },
      },
    }),
  ])
  return construirAvisos({
    oportunidades,
    tareas,
    meses: anio?.months ?? null,
    year,
    mesActual,
    hoyIso,
  })
}
