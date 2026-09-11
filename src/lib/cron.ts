// Planificador interno (node-cron), arrancado por instrumentation.ts: apunta
// recurrentes, avisa por correo y push, y muestrea el servidor. Diario.
import 'server-only'
import cron from 'node-cron'
import { correoConfigurado } from '@/lib/correo'
import { avisarMesSinRellenar } from '@/lib/finance'
import { avisarTopes, generarRecurrentes } from '@/lib/gastos'
import { guardarMuestraInfra } from '@/lib/infra-historico'
import { avisosPendientes } from '@/lib/inicio'
import { avisarPush } from '@/lib/push'
import { avisarVencidas } from '@/lib/mantenimiento'
import { purgarLogs } from '@/lib/log-db'
import { avisarSeguimientos } from '@/lib/pipeline'
import { log } from '@/lib/log'

// globalThis: el guard sobrevive a los re-imports del hot-reload en desarrollo.
const marca = globalThis as { __cronIniciado?: boolean }

export function iniciarCron() {
  if (marca.__cronIniciado) return
  marca.__cronIniciado = true

  // El cron solo se programa en producción: en local con SMTP enviaba correos reales
  // y apuntaría recurrentes en la BD de desarrollo. CRON_EN_DEV=1 lo fuerza.
  if (process.env.NODE_ENV !== 'production' && process.env.CRON_EN_DEV !== '1') {
    log.info('cron', 'desarrollo: sin programar (CRON_EN_DEV=1 para forzarlo)')
    return
  }

  if (!correoConfigurado()) {
    // Los recurrentes SÍ se apuntan: no tienen nada que ver con el correo.
    log.info('cron', 'SMTP sin configurar: los avisos por correo quedan inactivos')
  }

  // Push aparte del correo: dos canales independientes. Sin SMTP el push sigue, y
  // sin claves VAPID el correo también.
  const empujar = () => {
    avisosPendientes()
      .then((avisos) => avisarPush(avisos))
      .then((n) => {
        if (n > 0) log.info('cron', 'aviso push entregado', { dispositivos: n })
      })
      .catch((e) => log.error('cron', 'aviso push fallido', { error: e }))
  }

  // Cada tarea captura sus propios errores: que falle una no frena a las otras.
  const avisar = () => {
    empujar()
    if (!correoConfigurado()) return
    avisarVencidas()
      .then((n) => {
        if (n > 0) log.info('cron', 'aviso de mantenimiento enviado', { vencidas: n })
      })
      .catch((e) => log.error('cron', 'aviso de mantenimiento fallido', { error: e }))
    avisarSeguimientos()
      .then((n) => {
        if (n > 0) log.info('cron', 'aviso de seguimientos enviado', { oportunidades: n })
      })
      .catch((e) => log.error('cron', 'aviso de seguimientos fallido', { error: e }))
    avisarMesSinRellenar()
      .then((n) => {
        if (n > 0) log.info('cron', 'recordatorio de ahorro enviado', { meses: n })
      })
      .catch((e) => log.error('cron', 'recordatorio de ahorro fallido', { error: e }))
    avisarTopes()
      .then((n) => {
        if (n > 0) log.info('cron', 'aviso de topes enviado', { categorias: n })
      })
      .catch((e) => log.error('cron', 'aviso de topes fallido', { error: e }))
  }

  // Los recurrentes van primero: el aviso de topes del día 1 debe contar ya con el
  // alquiler apuntado. Si la generación falla, los avisos salen igual.
  const ejecutar = () => {
    generarRecurrentes()
      .then((n) => {
        if (n > 0) {
          log.info('cron', 'recurrentes apuntados', { movimientos: n })
        }
      })
      .catch((e) => log.error('cron', 'recurrentes fallidos', { error: e }))
      .finally(avisar)

    // Muestra diaria del monitor, al margen de todo lo anterior: no depende del
    // correo ni de los recurrentes, y ya se traga sus propios errores.
    guardarMuestraInfra().then((ok) => {
      if (ok) log.info('cron', 'muestra de infraestructura guardada')
    })

    // Purga del registro de eventos. Sin retención, la tabla solo crece: un
    // error que se repite en bucle puede meter miles de filas en una noche.
    purgarLogs()
      .then((n) => {
        if (n > 0) log.info('cron', 'registro purgado', { eventos: n })
      })
      .catch((e) => log.error('cron', 'purga del registro fallida', { error: e }))
  }

  // Diario a las 8:00 (hora española) y una pasada al minuto de arrancar: si un
  // despliegue pilla las 8:00 apagado, el aviso no se pierde.
  cron.schedule('0 8 * * *', ejecutar, { timezone: 'Europe/Madrid' })
  setTimeout(ejecutar, 60_000)
  log.info('cron', 'programado (diario, 8:00 Europe/Madrid)')
}
