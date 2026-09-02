// Cuándo caduca una sesión del dashboard. Fuente única para `auth.ts` (que
// decide) y para el Panel de control (que lo cuenta y purga).
//
// Hasta ahora había UN plazo: el JWT vivía 7 días y punto. Eso deja fuera el
// caso que de verdad importa —una sesión abierta y OLVIDADA en un navegador
// ajeno—, porque los 7 días corren igual la uses o no. Ahora hay dos, que es lo
// que significa "granular":
//
//   · TOPE ABSOLUTO (`SESION_DIAS`, 7 por defecto): desde el login, pase lo que
//     pase. Es el que ya existía, y el que garantiza que ninguna sesión es
//     eterna por muy activa que sea.
//   · INACTIVIDAD (`SESION_INACTIVIDAD_HORAS`, 48 por defecto): desde la última
//     petición. Una sesión que nadie toca se cierra sola mucho antes del tope.
//
// Con Google como único proveedor, volver a entrar son dos clics, así que el
// coste de la inactividad es casi nulo y lo que se gana es real. Ponerlo a 0
// desactiva ESE plazo (el absoluto sigue).
//
// Sin `server-only`: son números y una comparación pura, y los usan tanto
// `auth.ts` como la página del Panel — mismo criterio que `fechas.ts`.

/** Lee un entero de una variable de entorno, con tope y suelo. */
function entero(nombre: string, porDefecto: number, min: number, max: number): number {
  const crudo = process.env[nombre]
  if (crudo === undefined || crudo.trim() === '') return porDefecto
  const n = Number(crudo)
  if (!Number.isInteger(n) || n < min || n > max) return porDefecto
  return n
}

/** Días de vida del JWT desde el login. */
export const DIAS_SESION = entero('SESION_DIAS', 7, 1, 90)

/** Horas sin actividad tras las que la sesión se cierra (0 = sin límite). */
export const HORAS_INACTIVIDAD = entero('SESION_INACTIVIDAD_HORAS', 48, 0, 24 * 90)

export const SEGUNDOS_SESION = DIAS_SESION * 24 * 60 * 60

/** Momento a partir del cual una sesión es demasiado vieja (tope absoluto). */
export const limiteAbsoluto = (ahora = Date.now()) =>
  new Date(ahora - DIAS_SESION * 86_400_000)

/**
 * ¿Se ha pasado esta sesión de inactividad?
 *
 * Se compara contra `last_seen`, que el callback `jwt` refresca con freno de 5
 * minutos: por eso el plazo se mide en horas y no en minutos — un umbral por
 * debajo del freno cerraría sesiones vivas.
 */
export function inactivaDemasiado(lastSeen: Date, ahora = Date.now()): boolean {
  if (HORAS_INACTIVIDAD === 0) return false
  return ahora - lastSeen.getTime() > HORAS_INACTIVIDAD * 3_600_000
}

/** Texto de la política vigente, para enseñarla en el Panel. */
export function textoCaducidad(): string {
  const dias = `${DIAS_SESION} ${DIAS_SESION === 1 ? 'día' : 'días'}`
  if (HORAS_INACTIVIDAD === 0) return `Las sesiones caducan a los ${dias}`
  const horas = `${HORAS_INACTIVIDAD} ${HORAS_INACTIVIDAD === 1 ? 'hora' : 'horas'}`
  return `Las sesiones caducan a los ${dias} y tras ${horas} sin actividad`
}
