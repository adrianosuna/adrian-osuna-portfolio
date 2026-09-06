// Reglas puras de las tareas de mantenimiento: cuándo una tarea está vencida y
// cuándo está CUMPLIDA. Sin `server-only` a propósito (mismo criterio que
// `topes.ts`, `recurrentes.ts` y `fechas.ts`): las comparten el cron, los
// avisos del inicio, la lista de la pestaña y el calendario, y tener una copia
// en cada sitio es justo cómo se desincronizan — de hecho ya había dos.

export type EstadoTarea = 'vencida' | 'proxima' | 'aldia'

/** Estado de una tarea según su vencimiento: vencida, próxima (≤7 días) o al día. */
export function estadoDe(nextDueIso: string, hoyIso: string): EstadoTarea {
  if (nextDueIso <= hoyIso) return 'vencida'
  const dias =
    (new Date(`${nextDueIso}T00:00:00Z`).getTime() - new Date(`${hoyIso}T00:00:00Z`).getTime()) /
    86_400_000
  return dias <= 7 ? 'proxima' : 'aldia'
}

/**
 * Una tarea PUNTUAL (sin periodicidad) ya hecha: está cumplida y no vuelve.
 *
 * ⚠ Sin esto, un recordatorio puntual marcado como hecho no se callaba NUNCA.
 * `completeMaintenance` le pone `lastDone` y deja `nextDue` donde estaba a
 * propósito (queda el rastro de cuándo se hizo), así que su fecha se queda en
 * el pasado para siempre: figuraba «Vencida» en la lista, contaba en los
 * avisos del inicio, salía arrastrada a hoy en el calendario y el cron mandaba
 * su correo SEMANALMENTE sin forma de silenciarlo. Una tarea que se repite es
 * otra cosa: al marcarla hecha su `nextDue` avanza, y volver a vencer es lo
 * que se espera de ella.
 */
export const cumplida = (t: { intervalMonths: number | null; lastDone: string | null }) =>
  t.intervalMonths === null && t.lastDone !== null

/** Las que siguen pendientes: descarta las puntuales ya hechas. */
export const pendientes = <T extends { intervalMonths: number | null; lastDone: string | null }>(
  tareas: T[],
): T[] => tareas.filter((t) => !cumplida(t))
