// Lógica del pipeline de oportunidades: métricas del embudo (cabecera del
// tablero) y aviso por correo de seguimientos vencidos (lo dispara el cron
// diario, mismo patrón que el mantenimiento: reaviso semanal, no diario).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { botonHtml, correoConfigurado, enviarCorreo, tarjetaHtml } from '@/lib/correo'
import { hoyMadrid } from '@/lib/mantenimiento'
import { SITE_URL } from '@/lib/site'

// Estados en los que la oportunidad sigue viva (el resto son terminales).
const ESTADOS_ABIERTOS = ['CONTACTO', 'CONVERSACION', 'PROPUESTA'] as const

interface FilaMetrica {
  status: string
  amount: number | null
  createTs: Date
  closedAt: Date | null
}

export interface MetricasPipeline {
  /** Oportunidades vivas (contacto/conversación/propuesta). */
  abiertas: number
  /** Suma de importes estimados de las abiertas. */
  valorAbierto: number
  /** % cerradas sobre terminadas (cerradas + descartadas); null sin datos. */
  tasaCierre: number | null
  /** Días medios de la creación al cierre (solo cerradas); null sin datos. */
  diasMedioCierre: number | null
}

/** Métricas de cabecera del tablero. Recibe TODAS las oportunidades
 *  (incluidas las archivadas: la historia también cuenta). */
export function metricasPipeline(filas: FilaMetrica[]): MetricasPipeline {
  const vivas = filas.filter((f) => (ESTADOS_ABIERTOS as readonly string[]).includes(f.status))
  const cerradas = filas.filter((f) => f.status === 'CERRADO')
  const descartadas = filas.filter((f) => f.status === 'DESCARTADO')

  const terminadas = cerradas.length + descartadas.length
  const conCierre = cerradas.filter((f) => f.closedAt !== null)
  const diasMedios = conCierre.length
    ? conCierre.reduce((acc, f) => acc + (f.closedAt!.getTime() - f.createTs.getTime()), 0) /
      conCierre.length / 86_400_000
    : null

  return {
    abiertas: vivas.length,
    valorAbierto: vivas.reduce((acc, f) => acc + (f.amount ?? 0), 0),
    tasaCierre: terminadas ? Math.round((cerradas.length / terminadas) * 100) : null,
    diasMedioCierre: diasMedios === null ? null : Math.round(diasMedios),
  }
}

const fmt = (iso: string) => iso.split('-').reverse().join('/')

/** Aviso por correo de los seguimientos vencidos (próxima acción con fecha ya
 *  pasada en oportunidades vivas). Reaviso semanal mientras no se muevan.
 *  Devuelve cuántas oportunidades se avisaron. */
export async function avisarSeguimientos(): Promise<number> {
  if (!correoConfigurado()) return 0
  const hoy = hoyMadrid()
  const hace7dias = new Date(Date.now() - 7 * 86_400_000)

  const vencidas = await prisma.opportunity.findMany({
    where: {
      archived: false,
      status: { in: [...ESTADOS_ABIERTOS] },
      nextActionDate: { lte: new Date(`${hoy}T00:00:00Z`) },
      OR: [{ nextActionNotified: null }, { nextActionNotified: { lte: hace7dias } }],
    },
    orderBy: { nextActionDate: 'asc' },
  })
  if (!vencidas.length) return 0

  const tarjetas = vencidas
    .map((o) => {
      const fecha = o.nextActionDate!.toISOString().slice(0, 10)
      const dias = Math.floor(
        (new Date(`${hoy}T00:00:00Z`).getTime() - o.nextActionDate!.getTime()) / 86_400_000,
      )
      const detalle = `Seguimiento previsto el ${fmt(fecha)}${dias > 0 ? ` — hace ${dias} ${dias === 1 ? 'día' : 'días'}` : ' — hoy'}`
      const titulo = `${o.title}${o.company ? ` · ${o.company}` : ''}`
      // Rojo a partir de una semana de retraso; ámbar hasta entonces.
      return tarjetaHtml(titulo, detalle, o.nextAction, dias >= 7)
    })
    .join('')

  await enviarCorreo(
    `⏰ Pipeline: ${vencidas.length} ${vencidas.length === 1 ? 'seguimiento pendiente' : 'seguimientos pendientes'}`,
    `<p style="margin:0 0 14px">Oportunidades con la próxima acción ya vencida:</p>
     ${tarjetas}
     ${botonHtml('Abrir el pipeline', `${SITE_URL}/app/pipeline`)}
     <p style="margin:14px 0 0;font-size:12px;color:#64766f">Al hacer el seguimiento, apunta la
     siguiente acción (o retira la fecha). Este aviso se repite semanalmente mientras siga pendiente.</p>`,
  )

  await prisma.opportunity.updateMany({
    where: { uuid: { in: vencidas.map((o) => o.uuid) } },
    data: { nextActionNotified: new Date() },
  })
  return vencidas.length
}
