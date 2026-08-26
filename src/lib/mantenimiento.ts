// Lógica del sistema de tareas de mantenimiento del servidor: fechas de
// vencimiento (en días naturales de Madrid), recálculo al completar y el
// aviso por correo de las vencidas que dispara el cron diario.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { botonHtml, correoConfigurado, enviarCorreo, tarjetaHtml } from '@/lib/correo'
import { SITE_URL } from '@/lib/site'

/** Hoy en horario de Madrid, como 'YYYY-MM-DD'. */
export const hoyMadrid = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })

/** Suma meses a una fecha ISO recortando al último día del mes destino
 *  (31 de enero + 1 mes = 28/29 de febrero, no 3 de marzo). */
export function sumarMeses(fechaIso: string, meses: number): string {
  const [y, m, d] = fechaIso.split('-').map(Number)
  const total = m - 1 + meses
  const y2 = y + Math.floor(total / 12)
  const m2 = ((total % 12) + 12) % 12
  const ultimoDia = new Date(Date.UTC(y2, m2 + 1, 0)).getUTCDate()
  return `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(Math.min(d, ultimoDia)).padStart(2, '0')}`
}

/** Estado de una tarea según su vencimiento: vencida, próxima (≤7 días) o al día. */
export function estadoDe(nextDueIso: string, hoyIso: string): 'vencida' | 'proxima' | 'aldia' {
  if (nextDueIso <= hoyIso) return 'vencida'
  const dias = (new Date(`${nextDueIso}T00:00:00Z`).getTime() - new Date(`${hoyIso}T00:00:00Z`).getTime()) / 86_400_000
  return dias <= 7 ? 'proxima' : 'aldia'
}

const fmt = (iso: string) => iso.split('-').reverse().join('/')

/** Aviso por correo de las tareas vencidas (lo dispara el cron diario a las
 *  8:00). Reaviso semanal mientras sigan pendientes, no diario: un correo al
 *  día sería spam propio. Devuelve cuántas tareas se avisaron. */
export async function avisarVencidas(): Promise<number> {
  if (!correoConfigurado()) return 0
  const hoy = hoyMadrid()
  const hace7dias = new Date(Date.now() - 7 * 86_400_000)

  const vencidas = await prisma.maintenanceTask.findMany({
    where: {
      nextDue: { lte: new Date(`${hoy}T00:00:00Z`) },
      OR: [{ lastNotified: null }, { lastNotified: { lte: hace7dias } }],
    },
    orderBy: { nextDue: 'asc' },
  })
  if (!vencidas.length) return 0

  const tarjetas = vencidas
    .map((t) => {
      const vence = t.nextDue.toISOString().slice(0, 10)
      const dias = Math.floor((new Date(`${hoy}T00:00:00Z`).getTime() - t.nextDue.getTime()) / 86_400_000)
      const detalle = `Vencía el ${fmt(vence)}${dias > 0 ? ` — hace ${dias} ${dias === 1 ? 'día' : 'días'}` : ' — hoy'}`
      // Rojo a partir de una semana de retraso; ámbar hasta entonces.
      return tarjetaHtml(t.title, detalle, t.notes, dias >= 7)
    })
    .join('')

  await enviarCorreo(
    `⚠ Mantenimiento pendiente: ${vencidas.length} ${vencidas.length === 1 ? 'tarea' : 'tareas'}`,
    `<p style="margin:0 0 14px">Tareas de mantenimiento del servidor que han vencido:</p>
     ${tarjetas}
     ${botonHtml('Abrir el Panel de control', `${SITE_URL}/app/panel?tab=mantenimiento`)}
     <p style="margin:14px 0 0;font-size:12px;color:#64766f">Marca cada tarea como hecha y su contador
     volverá a empezar. Este aviso se repite semanalmente mientras sigan pendientes.</p>`,
  )

  await prisma.maintenanceTask.updateMany({
    where: { uuid: { in: vencidas.map((t) => t.uuid) } },
    data: { lastNotified: new Date() },
  })
  return vencidas.length
}
