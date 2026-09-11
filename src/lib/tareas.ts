// Reglas puras de las tareas: vencida y cumplida. Sin `server-only`: las comparten
// el cron, los avisos del inicio, la lista y el calendario.

export type EstadoTarea = 'vencida' | 'proxima' | 'aldia'

/** Estado de una tarea según su vencimiento: vencida, próxima (≤7 días) o al día. */
export function estadoDe(nextDueIso: string, hoyIso: string): EstadoTarea {
  if (nextDueIso <= hoyIso) return 'vencida'
  const dias =
    (new Date(`${nextDueIso}T00:00:00Z`).getTime() - new Date(`${hoyIso}T00:00:00Z`).getTime()) /
    86_400_000
  return dias <= 7 ? 'proxima' : 'aldia'
}

/** Una puntual ya hecha está cumplida y no vuelve. Sin esto seguía "vencida" para
 *  siempre: en la lista, los avisos, el calendario y el correo semanal del cron. */
export const cumplida = (t: { intervalMonths: number | null; lastDone: string | null }) =>
  t.intervalMonths === null && t.lastDone !== null

/** Las que siguen pendientes: descarta las puntuales ya hechas. */
export const pendientes = <T extends { intervalMonths: number | null; lastDone: string | null }>(
  tareas: T[],
): T[] => tareas.filter((t) => !cumplida(t))
