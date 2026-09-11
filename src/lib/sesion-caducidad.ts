// Caducidad de la sesión, fuente única para `auth.ts` y el Panel: tope absoluto
// (SESION_DIAS) e inactividad (SESION_INACTIVIDAD_HORAS; 0 la desactiva).

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

/** ¿Se ha pasado de inactividad? Se compara con `last_seen`, que se refresca con
 *  freno de 5 min: por eso el plazo va en horas, no en minutos. */
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
