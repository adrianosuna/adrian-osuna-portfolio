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
// Además de la consola, `warn` y `error` se GUARDAN para poder verlos desde el
// Panel de control (07/09). Pero este módulo no sabe nada de eso: se le
// registra un SUMIDERO desde fuera (`registrarSumidero`), y quien lo hace es
// `lib/log-db.ts` a través de `instrumentation.ts`.
//
// ⚠ Va por registro y no importando Prisma aquí por una razón concreta: este
// fichero no lleva `server-only` porque lo usan los tests y podría llamarlo un
// componente cliente. Importar el cliente de Prisma lo ataría al servidor y
// reventaría el bundle del navegador.
//
// Lo que sigue descartado es un monitor EXTERNO (Sentry y compañía): ver el
// CHANGELOG del 28/08. Los logs se quedan en casa.

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

/** Un evento ya normalizado, tal como lo recibe un sumidero. */
export interface EventoLog {
  nivel: Nivel
  scope: string
  mensaje: string
  datos?: Record<string, unknown>
}

type Sumidero = (evento: EventoLog) => void

/**
 * Sumidero para los TESTS. En producción no se usa: ver `persistir`.
 */
let sumideroDePrueba: Sumidero | null = null

/** Sustituye el sumidero (solo tests). `null` vuelve al de verdad. */
export function registrarSumidero(fn: Sumidero | null) {
  sumideroDePrueba = fn
}

/**
 * Guarda el evento, cargando el sumidero **en el propio contexto que
 * registra**.
 *
 * ⚠ **No se engancha desde fuera, y esto viene de un fallo real.** La primera
 * versión guardaba el sumidero en una variable de módulo y lo registraba desde
 * `instrumentation.ts`: no se guardaba NADA y sin ningún error (comprobado en
 * desarrollo). La causa es que `instrumentation` corre en un grafo de módulos
 * distinto al de los route handlers, así que el registro caía en una instancia
 * de `log.ts` y los eventos salían de otra.
 *
 * Se probó a moverlo a `globalThis`, que es del proceso y debería atravesarlo.
 * Funcionó en desarrollo; en producción no se llegó a demostrar ni una cosa ni
 * la otra, porque las comprobaciones apuntaban sin saberlo a una BD
 * inalcanzable (`.env.production` usa el host `db` de Docker). Así que la
 * pregunta se quedó abierta — y por eso se cambió el enfoque: **no depender de
 * que nadie registre nada.** El import es PEREZOSO y lo hace quien emite, así
 * que cada contexto carga su propio sumidero y no hay nada que compartir. Esto
 * SÍ está verificado sobre un build de producción con BD alcanzable.
 *
 * `log-db` es server-only e importa Prisma. No lo importa ningún componente
 * cliente (comprobado: los 19 módulos que usan `log.ts` son de servidor), y si
 * algún día lo hiciera, el build fallaría — que es mejor que mandar Prisma al
 * navegador en silencio.
 */
/** Para no repetir el aviso en cada evento si el sumidero no carga. */
let sumideroRoto = false

function persistir(evento: EventoLog) {
  if (typeof window !== 'undefined') return
  void import('@/lib/log-db')
    .then((m) => m.guardarEvento(evento))
    .catch((e: unknown) => {
      // ⚠ Se avisa UNA vez, no se traga en silencio: un registro de errores que
      // falla sin decirlo es peor que no tenerlo, y es justo lo que pasó dos
      // veces con los intentos anteriores. Por consola directamente, que este
      // camino no puede volver a entrar en `emitir`.
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

  // ⚠ Guarda de RE-ENTRADA. El sumidero escribe en la BD, y si la BD es
  // justo lo que está fallando, su propio `log.error` volvería a entrar aquí:
  // un bucle que se come el proceso en el peor momento posible. Mientras el
  // sumidero corre, lo que registre va solo a la consola.
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
