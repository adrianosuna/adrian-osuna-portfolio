// Planificador interno de la app (node-cron): la arranca instrumentation.ts
// una sola vez por proceso. Hoy hace dos cosas al día: APUNTAR los movimientos
// recurrentes que han vencido y AVISAR por correo (mantenimiento vencido,
// seguimientos del pipeline, meses de ahorro sin rellenar y topes de gasto
// alcanzados). El trabajo periódico futuro va aquí.
import 'server-only'
import cron from 'node-cron'
import { correoConfigurado } from '@/lib/correo'
import { avisarMesSinRellenar } from '@/lib/finance'
import { avisarTopes, generarRecurrentes } from '@/lib/gastos'
import { avisarVencidas } from '@/lib/mantenimiento'
import { avisarSeguimientos } from '@/lib/pipeline'

// globalThis: el guard sobrevive a los re-imports del hot-reload en desarrollo.
const marca = globalThis as { __cronIniciado?: boolean }

export function iniciarCron() {
  if (marca.__cronIniciado) return
  marca.__cronIniciado = true

  // El cron solo se programa en producción: con SMTP configurado en local,
  // arrancar el dev server enviaba correos reales (la pasada de arranque salta
  // al minuto) y apuntaría recurrentes en la BD de desarrollo.
  // CRON_EN_DEV=1 lo fuerza para poder probarlo a mano.
  if (process.env.NODE_ENV !== 'production' && process.env.CRON_EN_DEV !== '1') {
    console.log('[cron] desarrollo: sin programar (CRON_EN_DEV=1 para forzarlo)')
    return
  }

  if (!correoConfigurado()) {
    // Los recurrentes SÍ se apuntan: no tienen nada que ver con el correo.
    console.log('[cron] SMTP sin configurar: los avisos por correo quedan inactivos')
  }

  // Cada tarea captura sus propios errores: que falle una no frena a las otras.
  const avisar = () => {
    if (!correoConfigurado()) return
    avisarVencidas()
      .then((n) => {
        if (n > 0) console.log(`[cron] aviso de mantenimiento enviado (${n} tareas vencidas)`)
      })
      .catch((e) => console.error('[cron] aviso de mantenimiento fallido:', e))
    avisarSeguimientos()
      .then((n) => {
        if (n > 0) console.log(`[cron] aviso de seguimientos enviado (${n} oportunidades)`)
      })
      .catch((e) => console.error('[cron] aviso de seguimientos fallido:', e))
    avisarMesSinRellenar()
      .then((n) => {
        if (n > 0) console.log(`[cron] recordatorio de ahorro enviado (${n} meses sin rellenar)`)
      })
      .catch((e) => console.error('[cron] recordatorio de ahorro fallido:', e))
    avisarTopes()
      .then((n) => {
        if (n > 0) console.log(`[cron] aviso de topes enviado (${n} categorías)`)
      })
      .catch((e) => console.error('[cron] aviso de topes fallido:', e))
  }

  // Los recurrentes van PRIMERO y los avisos esperan a que terminen: si hoy es
  // día 1, el aviso de topes tiene que contar ya con el alquiler recién
  // apuntado. Si la generación falla, los avisos salen igual.
  const ejecutar = () => {
    generarRecurrentes()
      .then((n) => {
        if (n > 0) {
          console.log(`[cron] recurrentes apuntados (${n} ${n === 1 ? 'movimiento' : 'movimientos'})`)
        }
      })
      .catch((e) => console.error('[cron] recurrentes fallidos:', e))
      .finally(avisar)
  }

  // Diario a las 8:00 (hora española), y una pasada de arranque al minuto de
  // levantar el proceso: si un despliegue pilla el servidor apagado a las
  // 8:00, el aviso no se pierde (el reaviso semanal evita duplicados).
  cron.schedule('0 8 * * *', ejecutar, { timezone: 'Europe/Madrid' })
  setTimeout(ejecutar, 60_000)
  console.log('[cron] programado (diario, 8:00 Europe/Madrid)')
}
