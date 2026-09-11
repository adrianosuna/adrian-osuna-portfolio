// Calendario: reúne tareas (`next_due`), cargos (`next_date` + `day_anchor`) y
// seguimientos (`next_action_date`) en un tipo de evento por día. Puro, sin server-only.
import { sumarMeses } from '@/lib/fechas'
import { eurEntero } from '@/lib/euros'
import { cumplida } from '@/lib/tareas'
import { fechasEnMes } from '@/lib/recurrentes'

export type TipoEvento = 'mantenimiento' | 'recurrente' | 'seguimiento'

export interface Evento {
  /** `${tipo}:${uuid}`. Una serie repite uuid en días distintos, y es correcto. */
  uuid: string
  tipo: TipoEvento
  /** 'YYYY-MM-DD' — el día en que cae ESTA ocurrencia. */
  fecha: string
  titulo: string
  /** Segunda línea: el ámbito, el importe, la acción a hacer. */
  detalle: string | null
  /** Su fecha ya pasó y sigue pendiente. */
  atrasado: boolean
  /** El uuid de la fila original, para abrirla en su módulo. */
  refUuid: string
}

/** Lo que el calendario necesita de una tarea de mantenimiento. */
export interface TareaCal {
  uuid: string
  title: string
  scopeName: string | null
  /** null = no se repite (recordatorio puntual). */
  intervalMonths: number | null
  nextDue: string
  /** Cuándo se marcó hecha. Una PUNTUAL con esto puesto ya está cumplida y no
   *  debe salir: su `nextDue` se queda en el pasado a propósito. */
  lastDone: string | null
}

/** Lo que necesita de un cargo recurrente. */
export interface RecurrenteCal {
  uuid: string
  concept: string
  type: 'INGRESO' | 'GASTO'
  amount: number
  intervalMonths: number
  nextDate: string
  dayAnchor: number
  active: boolean
}

/** Y de un seguimiento del pipeline. */
export interface SeguimientoCal {
  uuid: string
  title: string
  company: string | null
  nextAction: string | null
  nextActionDate: string | null
  archived: boolean
}

/** Tope de saltos al encadenar UNA serie: solo protege de un intervalo
 *  corrupto o una fecha absurda, no del uso normal. */
const MAX_SALTOS = 600

const primerDia = (mes: string) => `${mes}-01`
/** Primer día del mes SIGUIENTE: límite superior, exclusivo. */
const finDe = (mes: string) => sumarMeses(primerDia(mes), 1)

/** Proyecta una serie desde `desde` cada `cada` meses en [inicio, fin), anclando el
 *  día si se pide. Dice además si la primera fecha quedó antes: eso es el atraso. */
function ocurrencias(
  desde: string,
  cada: number | null,
  inicio: string,
  fin: string,
  ancla?: number,
): { fechas: string[]; atrasada: boolean } {
  // Sin periodicidad es una fecha única (recordatorio puntual).
  if (cada === null || cada <= 0) {
    if (desde < inicio) return { fechas: [], atrasada: true }
    return desde < fin ? { fechas: [desde], atrasada: false } : { fechas: [], atrasada: false }
  }
  let f = desde
  let saltos = 0
  const atrasada = f < inicio
  while (f < inicio && saltos < MAX_SALTOS) {
    f = sumarMeses(f, cada, ancla)
    saltos++
  }
  const fechas: string[] = []
  while (f < fin && saltos < MAX_SALTOS) {
    fechas.push(f)
    f = sumarMeses(f, cada, ancla)
    saltos++
  }
  return { fechas, atrasada }
}

/** Importe con el signo de su tipo. Con `eurEntero`: es-ES no agrupa los miles de
 *  cuatro cifras y "1850 €" salía junto a "12.750 €". Sin decimales, como los KPI. */
const importe = (r: RecurrenteCal) =>
  `${r.type === 'GASTO' ? '−' : '+'}${eurEntero(Math.abs(r.amount))}`

/** Todos los eventos de un mes ('YYYY-MM'), ordenados. Lo vencido antes del mes se
 *  ancla a hoy, solo si se ve el mes en curso: una tarea vencida hay que verla. */
export function eventosDelMes(
  mes: string,
  hoy: string,
  fuentes: {
    tareas?: TareaCal[]
    recurrentes?: RecurrenteCal[]
    seguimientos?: SeguimientoCal[]
  },
): Evento[] {
  const inicio = primerDia(mes)
  const fin = finDe(mes)
  const esMesEnCurso = hoy.slice(0, 7) === mes
  const eventos: Evento[] = []
  const conAtraso = (base: Omit<Evento, 'fecha' | 'atrasado'>) => {
    if (esMesEnCurso) eventos.push({ ...base, fecha: hoy, atrasado: true })
  }

  for (const t of fuentes.tareas ?? []) {
    // Una puntual ya hecha no vuelve. Sin esto se arrastraba a hoy como
    // vencida para siempre, porque su fecha nunca avanza.
    if (cumplida(t)) continue
    const { fechas, atrasada } = ocurrencias(t.nextDue, t.intervalMonths, inicio, fin)
    const base = {
      uuid: `mantenimiento:${t.uuid}`,
      tipo: 'mantenimiento' as const,
      titulo: t.title,
      detalle: t.scopeName,
      refUuid: t.uuid,
    }
    if (atrasada) conAtraso(base)
    // `f < hoy` y no `false`: una tarea vencida dentro del mes no se arrastra, pero
    // sigue vencida. Solo se proyecta desde `nextDue`, así que anterior a hoy es vencida.
    for (const f of fechas) eventos.push({ ...base, fecha: f, atrasado: f < hoy })
  }

  for (const r of fuentes.recurrentes ?? []) {
    // Uno en pausa no va a cargar nada: no es una previsión.
    if (!r.active) continue
    // La proyección de un recurrente vive en `lib/recurrentes.ts`, compartida con la
    // tarjeta del mes: el ancla del día no puede tener dos implementaciones.
    const fechas = fechasEnMes(r, mes)
    const base = {
      uuid: `recurrente:${r.uuid}`,
      tipo: 'recurrente' as const,
      titulo: r.concept,
      detalle: importe(r),
      refUuid: r.uuid,
    }
    // Un cargo atrasado no se arrastra a hoy: lo apunta el cron en cuanto corra. Se
    // queda en su día si cae en el mes.
    for (const f of fechas) eventos.push({ ...base, fecha: f, atrasado: false })
  }

  for (const s of fuentes.seguimientos ?? []) {
    if (s.archived || !s.nextActionDate) continue
    const base = {
      uuid: `seguimiento:${s.uuid}`,
      tipo: 'seguimiento' as const,
      titulo: s.title,
      detalle: s.nextAction ?? s.company,
      refUuid: s.uuid,
    }
    if (s.nextActionDate < inicio) conAtraso(base)
    else if (s.nextActionDate < fin) {
      eventos.push({ ...base, fecha: s.nextActionDate, atrasado: s.nextActionDate < hoy })
    }
  }

  // Por día; dentro del día, lo atrasado primero (es lo urgente) y después por
  // tipo y título, para que el orden no baile entre renders.
  const peso = { mantenimiento: 0, seguimiento: 1, recurrente: 2 }
  return eventos.sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      Number(b.atrasado) - Number(a.atrasado) ||
      peso[a.tipo] - peso[b.tipo] ||
      a.titulo.localeCompare(b.titulo, 'es'),
  )
}

/** Agrupa por día ('YYYY-MM-DD' → eventos) para pintar la rejilla. */
export function porDia(eventos: Evento[]): Map<string, Evento[]> {
  const m = new Map<string, Evento[]>()
  for (const e of eventos) {
    const lista = m.get(e.fecha)
    if (lista) lista.push(e)
    else m.set(e.fecha, [e])
  }
  return m
}

/** Semanas del mes para la rejilla, desde lunes y con los huecos rellenos con los
 *  meses vecinos. */
export function semanasDelMes(mes: string): Array<Array<{ fecha: string; delMes: boolean }>> {
  const [y, m] = mes.split('-').map(Number)
  const dias = new Date(Date.UTC(y, m, 0)).getUTCDate()
  // getUTCDay(): 0 domingo … 6 sábado. Con la semana en lunes, el hueco
  // inicial del día 1 es (dia + 6) % 7.
  const hueco = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const celdas: Array<{ fecha: string; delMes: boolean }> = []
  for (let i = hueco; i > 0; i--) {
    celdas.push({ fecha: iso(new Date(Date.UTC(y, m - 1, 1 - i))), delMes: false })
  }
  for (let d = 1; d <= dias; d++) {
    celdas.push({ fecha: iso(new Date(Date.UTC(y, m - 1, d))), delMes: true })
  }
  let extra = 1
  while (celdas.length % 7 !== 0) {
    celdas.push({ fecha: iso(new Date(Date.UTC(y, m - 1, dias + extra))), delMes: false })
    extra++
  }
  const semanas: Array<Array<{ fecha: string; delMes: boolean }>> = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))
  return semanas
}
