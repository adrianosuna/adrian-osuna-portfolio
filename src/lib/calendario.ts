// Calendario del dashboard: reúne TODO lo que tiene fecha futura en un solo
// tipo de evento y lo reparte por días.
//
// Las tres fuentes viven en módulos distintos y cada una tiene sus reglas:
//   · Tareas de mantenimiento (`next_due`), que se REPITEN cada N meses —o no,
//     si son un recordatorio puntual— y pueden estar atrasadas.
//   · Cargos recurrentes (`next_date` + `day_anchor`), que también se repiten
//     y cuyo día se ancla para que un recibo del 31 no se clave en el 28.
//   · Seguimientos del pipeline (`next_action_date`), que son una fecha única.
//
// Sin `server-only`: lo usan el calendario (cliente) y sus tests. La
// proyección es PURA a propósito — la aritmética de meses cortos y el cruce de
// año es justo donde esto se rompe, y así se prueba sin BD.
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

/**
 * Proyecta una serie que empieza en `desde` y salta cada `cada` meses dentro
 * de [inicio, fin), anclando el día si se pide.
 *
 * Devuelve además si la primera fecha quedó ANTES de la ventana: eso es el
 * atraso, y quien llama decide dónde lo coloca.
 */
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

/**
 * Importe con el signo de su tipo, para el detalle de un recurrente.
 *
 * ⚠ Con `eurEntero` y no con un `toLocaleString('es-ES')` a mano: es-ES NO
 * agrupa los miles de cuatro cifras por defecto, así que una nómina de 1850
 * salía como "1850 €" junto a un "12.750 €". Es la trampa que ya documenta
 * `lib/euros.ts`, y la razón de que el formateador sea uno y compartido.
 * Sin decimales porque es una previsión, como los KPI.
 */
const importe = (r: RecurrenteCal) =>
  `${r.type === 'GASTO' ? '−' : '+'}${eurEntero(Math.abs(r.amount))}`

/**
 * Todos los eventos de un mes ('YYYY-MM'), ordenados.
 *
 * `hoy` decide qué se marca como atrasado y dónde va: lo que venció antes de
 * este mes se ancla al día de HOY, y solo si se está viendo el mes en curso.
 * Dejarlo caer fuera del calendario sería lo contrario de lo que se busca —
 * una tarea vencida es justo la que hay que ver.
 */
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
    // ⚠ `f < hoy` y no `false`: una tarea que venció el día 3 estando hoy a 5
    // cae DENTRO del mes, así que no se arrastra a hoy — pero sigue vencida, y
    // pintarla como una cualquiera era perder de vista justo lo urgente. Solo
    // se proyectan fechas desde `nextDue`, que es la próxima pendiente: una
    // ocurrencia anterior a hoy está vencida por definición.
    for (const f of fechas) eventos.push({ ...base, fecha: f, atrasado: f < hoy })
  }

  for (const r of fuentes.recurrentes ?? []) {
    // Uno en pausa no va a cargar nada: no es una previsión.
    if (!r.active) continue
    // La proyección de un recurrente vive en `lib/recurrentes.ts`, compartida
    // con la tarjeta de la vista del mes: el ancla del día y los meses cortos
    // no pueden tener dos implementaciones.
    const fechas = fechasEnMes(r, mes)
    const base = {
      uuid: `recurrente:${r.uuid}`,
      tipo: 'recurrente' as const,
      titulo: r.concept,
      detalle: importe(r),
      refUuid: r.uuid,
    }
    // ⚠ Un cargo atrasado NO se arrastra a hoy como una tarea: el cron lo
    // apunta en cuanto corra, así que no es algo que Adrián tenga que hacer.
    // Se queda en su día si cae en el mes, y si no, no sale.
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

/**
 * Las semanas del mes para la rejilla, empezando en LUNES y con los huecos
 * rellenos con los días de los meses vecinos: una rejilla completa se lee
 * mejor que una con celdas en blanco.
 */
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
