// Sumidero persistente del registro: guarda `warn` y `error` en `log_event`
// para poder verlos desde el Panel de control, sin SSH ni `docker logs`.
//
// Por qué existe: `lib/log.ts` escribe a la consola, y en producción eso
// significa entrar por SSH a leer `docker compose logs web`. Se hace cuando ya
// se sospecha algo, no cuando pasa — así que un error de un martes por la
// tarde no se ve nunca. Aquí se queda guardado.
//
// Solo warn y error: `info` incluye una línea por cada pasada del cron y por
// cada login, y guardar eso convierte la tabla en un vertedero donde el error
// de verdad no se encuentra.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { NIVELES, type EventoLog, type Nivel } from '@/lib/log'

/** Los niveles que se persisten. El resto se queda en la consola. */
const GUARDADOS: readonly Nivel[] = ['warn', 'error']

/** Retención en días. `LOG_RETENCION_DIAS` la ajusta; 0 desactiva la purga. */
export const retencionDias = () => {
  const v = Number(process.env.LOG_RETENCION_DIAS)
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 30
}

// Los límites son los de las columnas: recortar aquí es mejor que perder el
// evento entero por un mensaje largo.
const MAX_MENSAJE = 500
const MAX_SCOPE = 60
const MAX_DATOS = 8000

/**
 * La traza SÍ se guarda, al contrario que en la consola de producción.
 *
 * `lib/log.ts` la omite allí porque el log de un servidor es público para
 * quien pueda leerlo y la traza filtra rutas del sistema. Esta tabla es
 * privada del admin y la traza es justo lo que hace falta para depurar, así
 * que aquí se recupera del `Error` original.
 */
function serializar(datos?: Record<string, unknown>): string | null {
  if (!datos || !Object.keys(datos).length) return null
  try {
    const texto = JSON.stringify(datos, (_clave, valor) =>
      valor instanceof Error
        ? { error: valor.name, mensaje: valor.message, traza: valor.stack }
        : valor,
    )
    if (texto === undefined) return null
    return texto.length > MAX_DATOS ? `${texto.slice(0, MAX_DATOS)}…(recortado)` : texto
  } catch {
    // Un ciclo o un BigInt en los datos no puede costar el evento.
    return '{"aviso":"los datos del evento no se pudieron serializar"}'
  }
}

/**
 * Escribe el evento, sin esperarlo y sin poder fallar hacia fuera.
 *
 * ⚠ Tres cosas que no son opcionales aquí:
 *   · **No se espera** (`void`): el registro no puede añadir la latencia de un
 *     INSERT a la petición que lo generó.
 *   · **Se traga sus errores** y solo avisa por consola: si la BD está caída,
 *     el `log.error` que lo diría volvería a entrar por aquí. La guarda de
 *     re-entrada de `log.ts` corta el bucle, y este catch corta el ruido.
 *   · **Nunca lanza**: `log.ts` lo llama dentro de la petición.
 */
export function guardarEvento(e: EventoLog) {
  if (!GUARDADOS.includes(e.nivel)) return
  void prisma.logEvent
    .create({
      data: {
        level: e.nivel,
        scope: e.scope.slice(0, MAX_SCOPE),
        message: e.mensaje.slice(0, MAX_MENSAJE),
        data: serializar(e.datos),
      },
    })
    .catch((err: unknown) => {
      // A consola directamente, NO por `log.error`: ese camino vuelve aquí.
      console.error('[log-db] no se pudo guardar el evento', err)
    })
}


// ─────────── lectura (Panel de control) ───────────

export interface LogRow {
  uuid: string
  level: Nivel
  scope: string
  message: string
  /** El JSON de `data`, ya parseado, o null. */
  datos: Record<string, unknown> | null
  createTs: string
}

export interface LogPagina {
  filas: LogRow[]
  /** Total de coincidencias, no de la página: es lo que se venía a saber. */
  total: number
  /** Cuántos hay por nivel, sobre el filtro de fecha y texto (no el de nivel). */
  porNivel: { warn: number; error: number }
  /** Los scopes presentes, para ofrecer el filtro solo con lo que hay. */
  scopes: string[]
}

export const POR_PAGINA = 50

/** Filtros de la vista. Todos opcionales. */
export interface FiltrosLog {
  nivel?: 'warn' | 'error'
  scope?: string
  /** Texto libre sobre el mensaje. */
  q?: string
  /** Días hacia atrás (por defecto, todo lo retenido). */
  dias?: number
  pagina?: number
}

const nivelDe = (v: string): Nivel =>
  (NIVELES as readonly string[]).includes(v) ? (v as Nivel) : 'error'

/**
 * Una página de eventos, con las cuentas que necesita la cabecera.
 *
 * El texto se busca con `contains` sobre `message`: un `LIKE '%x%'` no usa
 * índice, pero la tabla está acotada por retención y el filtro de fecha va
 * antes — mismo criterio que la búsqueda de movimientos.
 */
export async function listLogs(f: FiltrosLog = {}): Promise<LogPagina> {
  const pagina = Math.max(1, f.pagina ?? 1)
  const desde =
    f.dias && f.dias > 0 ? new Date(Date.now() - f.dias * 86_400_000) : undefined

  // El filtro de nivel NO entra en las cuentas por nivel: si no, la pestaña
  // "solo errores" diría que hay 0 warns y no se podría volver.
  const comun = {
    ...(desde ? { createTs: { gte: desde } } : {}),
    ...(f.scope ? { scope: f.scope } : {}),
    ...(f.q ? { message: { contains: f.q } } : {}),
  }
  const where = { ...comun, ...(f.nivel ? { level: f.nivel } : {}) }

  const [filas, total, cuentas, scopes] = await Promise.all([
    prisma.logEvent.findMany({
      where,
      orderBy: [{ createTs: 'desc' }, { id: 'desc' }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.logEvent.count({ where }),
    prisma.logEvent.groupBy({ by: ['level'], where: comun, _count: { _all: true } }),
    prisma.logEvent.groupBy({ by: ['scope'], where: comun }),
  ])

  const cuenta = (n: 'warn' | 'error') =>
    cuentas.find((c) => c.level === n)?._count._all ?? 0

  return {
    filas: filas.map((r) => ({
      uuid: r.uuid,
      level: nivelDe(r.level),
      scope: r.scope,
      message: r.message,
      datos: parsear(r.data),
      createTs: r.createTs.toISOString(),
    })),
    total,
    porNivel: { warn: cuenta('warn'), error: cuenta('error') },
    scopes: scopes.map((s) => s.scope).sort((a, b) => a.localeCompare(b, 'es')),
  }
}

function parsear(texto: string | null): Record<string, unknown> | null {
  if (!texto) return null
  try {
    const v: unknown = JSON.parse(texto)
    return v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : { valor: v }
  } catch {
    // Un `data` recortado por MAX_DATOS ya no es JSON válido: se enseña crudo
    // en vez de perderlo, que para depurar sigue valiendo.
    return { crudo: texto }
  }
}

/**
 * Purga los eventos más viejos que la retención. Lo llama el cron diario.
 *
 * Devuelve cuántos borró. Sin esto la tabla solo crece: un error que se repite
 * en bucle puede meter miles de filas en una noche.
 */
export async function purgarLogs(): Promise<number> {
  const dias = retencionDias()
  if (dias === 0) return 0
  const { count } = await prisma.logEvent.deleteMany({
    where: { createTs: { lt: new Date(Date.now() - dias * 86_400_000) } },
  })
  return count
}
