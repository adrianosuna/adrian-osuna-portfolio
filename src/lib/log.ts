// Registro de la aplicación, con niveles y salida estructurada.
//
// El problema que resuelve: el proyecto venía usando `console.log` y
// `console.error` con un prefijo a mano (`[cron]`, `[gastos]`, `[ga]`). Eso se
// lee bien en el terminal del dev server, pero en producción los logs se miran
// con `docker compose logs` y ahí no hay forma de filtrar por severidad ni de
// buscar un campo — y no se puede bajar el ruido sin editar código.
//
// Ahora:
//   · CUATRO niveles (debug < info < warn < error) con el suelo en `LOG_LEVEL`
//     (por defecto: `debug` en desarrollo, `info` en producción).
//   · En PRODUCCIÓN una línea JSON por evento, que `docker logs | jq` filtra.
//     En DESARROLLO el formato corto de siempre, que es el que se lee de un
//     vistazo mientras programas.
//   · El `scope` sigue siendo el prefijo de antes, ahora como campo.
//
// Sin `server-only`: los niveles y el tipo los usan también los tests, y un
// `log.warn` desde un componente cliente no debería explotar (cae a console).
//
// Lo que NO hace: mandar los logs a ningún sitio. Un monitor externo es una
// decisión de proyecto que está descartada (ver CHANGELOG, 28/08).

export const NIVELES = ['debug', 'info', 'warn', 'error'] as const
export type Nivel = (typeof NIVELES)[number]

/** Orden de severidad, para comparar contra el suelo configurado. */
const PESO: Record<Nivel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

/**
 * Suelo de severidad. Se resuelve en cada llamada (no se cachea) para que
 * cambiar `LOG_LEVEL` y reiniciar sea suficiente, y para que los tests puedan
 * moverlo sin recargar el módulo.
 */
export function nivelMinimo(): Nivel {
  const pedido = (process.env.LOG_LEVEL ?? '').toLowerCase() as Nivel
  if ((NIVELES as readonly string[]).includes(pedido)) return pedido
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

/** ¿Se registra este nivel con la configuración actual? */
export const registra = (nivel: Nivel) => PESO[nivel] >= PESO[nivelMinimo()]

/**
 * Un Error no es serializable con JSON.stringify (`{}`): se extraen las partes
 * que sirven para depurar. La traza solo fuera de producción — en el log de un
 * servidor es ruido y puede filtrar rutas del sistema.
 */
function normalizar(valor: unknown): unknown {
  if (valor instanceof Error) {
    return {
      error: valor.name,
      mensaje: valor.message,
      ...(process.env.NODE_ENV === 'production' ? {} : { traza: valor.stack }),
    }
  }
  return valor
}

function emitir(nivel: Nivel, scope: string, mensaje: string, datos?: Record<string, unknown>) {
  if (!registra(nivel)) return

  const extra = datos
    ? Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, normalizar(v)]))
    : undefined

  // `console.error` para warn/error: van a stderr, que es donde los busca
  // cualquiera (y donde Docker los separa).
  const salida = PESO[nivel] >= PESO.warn ? console.error : console.log

  if (process.env.NODE_ENV === 'production') {
    salida(JSON.stringify({ ts: new Date().toISOString(), nivel, scope, mensaje, ...extra }))
    return
  }
  // Desarrollo: el formato de siempre, `[scope] mensaje` y los datos aparte.
  const etiqueta = nivel === 'info' ? '' : `${nivel.toUpperCase()} `
  if (extra && Object.keys(extra).length) salida(`${etiqueta}[${scope}] ${mensaje}`, extra)
  else salida(`${etiqueta}[${scope}] ${mensaje}`)
}

/**
 * Registro por niveles. `scope` es el módulo que registra ('cron', 'api',
 * 'push'…) y `datos` los campos que acompañan al evento.
 *
 *   log.info('cron', 'recurrentes apuntados', { n: 3 })
 *   log.error('push', 'envío fallido', { error: e })
 */
export const log = {
  debug: (scope: string, mensaje: string, datos?: Record<string, unknown>) =>
    emitir('debug', scope, mensaje, datos),
  info: (scope: string, mensaje: string, datos?: Record<string, unknown>) =>
    emitir('info', scope, mensaje, datos),
  warn: (scope: string, mensaje: string, datos?: Record<string, unknown>) =>
    emitir('warn', scope, mensaje, datos),
  error: (scope: string, mensaje: string, datos?: Record<string, unknown>) =>
    emitir('error', scope, mensaje, datos),
}
