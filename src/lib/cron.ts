// Planificador interno de la app (node-cron): la arranca instrumentation.ts
// una sola vez por proceso. Hoy programa los avisos diarios de mantenimiento
// vencido, seguimientos del pipeline y meses de ahorro sin rellenar; el
// trabajo periódico futuro va aquí.
import 'server-only'
import cron from 'node-cron'
import { correoConfigurado } from '@/lib/correo'
import { avisarMesSinRellenar } from '@/lib/finance'
import { avisarVencidas } from '@/lib/mantenimiento'
import { avisarSeguimientos } from '@/lib/pipeline'

// globalThis: el guard sobrevive a los re-imports del hot-reload en desarrollo.
const marca = globalThis as { __cronIniciado?: boolean }

export function iniciarCron() {
  if (marca.__cronIniciado) return
  marca.__cronIniciado = true

  // Los avisos solo se programan en producción: con SMTP configurado en local,
  // arrancar el dev server enviaba correos reales (la pasada de arranque salta
  // al minuto). CRON_EN_DEV=1 los fuerza para poder probarlos a mano.
  if (process.env.NODE_ENV !== 'production' && process.env.CRON_EN_DEV !== '1') {
    console.log('[cron] desarrollo: avisos sin programar (CRON_EN_DEV=1 para forzarlos)')
    return
  }

  if (!correoConfigurado()) {
    console.log('[cron] SMTP sin configurar: los avisos por correo quedan inactivos')
    return
  }

  // Cada aviso captura sus propios errores: que falle uno no frena al otro.
  const ejecutar = () => {
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
  }

  // Diario a las 8:00 (hora española), y una pasada de arranque al minuto de
  // levantar el proceso: si un despliegue pilla el servidor apagado a las
  // 8:00, el aviso no se pierde (el reaviso semanal evita duplicados).
  cron.schedule('0 8 * * *', ejecutar, { timezone: 'Europe/Madrid' })
  setTimeout(ejecutar, 60_000)
  console.log('[cron] avisos programados (diario, 8:00 Europe/Madrid)')
}
