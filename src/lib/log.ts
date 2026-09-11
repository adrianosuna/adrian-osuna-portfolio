// Registro con cuatro niveles (suelo en LOG_LEVEL), JSON en producción y formato
// corto en desarrollo. Sin `server-only`; warn y error se guardan vía `persistir`.

export const NIVELES = ['debug', 'info', 'warn', 'error'] as const
export type Nivel = (typeof NIVELES)[number]

/** Orden de severidad, para comparar contra el suelo configurado. */
const PESO: Record<Nivel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

/** Suelo de severidad, resuelto en cada llamada: cambiar LOG_LEVEL y reiniciar basta,
 *  y los tests pueden moverlo sin recargar el módulo. */
export function nivelMinimo(): Nivel {
  const pedido = (process.env.LOG_LEVEL ?? '').toLowerCase() as Nivel
  if ((NIVELES as readonly string[]).includes(pedido)) return pedido
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

/** ¿Se registra este nivel con la configuración actual? */
export const registra = (nivel: Nivel) => PESO[nivel] >= PESO[nivelMinimo()]

/** Un Error no es serializable con JSON.stringify: se extraen nombre y mensaje. La
 *  traza solo fuera de producción. */
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

/** Un evento ya normalizado, tal como lo recibe un sumidero. */
export interface EventoLog {
  nivel: Nivel
  scope: string
  mensaje: string
  datos?: Record<string, unknown>
}

type Sumidero = (evento: EventoLog) => void

/** Sumidero para los tests. En producción no se usa: ver `persistir`. */
let sumideroDePrueba: Sumidero | null = null

/** Sustituye el sumidero (solo tests). `null` vuelve al de verdad. */
export function registrarSumidero(fn: Sumidero | null) {
  sumideroDePrueba = fn
}

/** Guarda el evento cargando el sumidero en el propio contexto que emite, con import
 *  perezoso: registrarlo desde `instrumentation.ts` no llegaba a los route handlers. */
/** Para no repetir el aviso en cada evento si el sumidero no carga. */
let sumideroRoto = false

function persistir(evento: EventoLog) {
  if (typeof window !== 'undefined') return
  void import('@/lib/log-db')
    .then((m) => m.guardarEvento(evento))
    .catch((e: unknown) => {
      // Se avisa una vez por consola: un registro que falla en silencio es peor que no
      // tenerlo. Directo a consola, que este camino no puede volver a `emitir`.
      if (!sumideroRoto) {
        sumideroRoto = true
        console.error('[log] el registro en BD no está disponible', e)
      }
    })
}

/** Si el sumidero está corriendo, para no re-entrar (ver abajo). */
let dentroDelSumidero = false

function emitir(nivel: Nivel, scope: string, mensaje: string, datos?: Record<string, unknown>) {
  if (!registra(nivel)) return

  const extra = datos
    ? Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, normalizar(v)]))
    : undefined

  // Guarda de re-entrada: si la BD falla, el `log.error` del sumidero volvería a
  // entrar aquí en bucle. Mientras corre, lo que registre va solo a la consola.
  if (PESO[nivel] >= PESO.warn && !dentroDelSumidero) {
    dentroDelSumidero = true
    try {
      ;(sumideroDePrueba ?? persistir)({ nivel, scope, mensaje, datos: extra })
    } catch {
      // Un sumidero roto no puede tumbar la petición que lo llamó.
    } finally {
      dentroDelSumidero = false
    }
  }

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

/** Registro por niveles. `scope` es el módulo ('cron', 'api') y `datos` los
 *  campos del evento: log.info('cron', 'recurrentes apuntados', { n: 3 }). */
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
