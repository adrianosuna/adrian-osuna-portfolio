// Previsión de cierre de mes: en qué va a acabar el gasto del mes si sigue
// así, y no solo en cuánto va.
//
// Lo que responde: a día 7 llevas 1.398 € gastados. ¿Eso es mucho o poco? Sin
// esto hay que hacer la regla de tres a mano, y encima mal, porque el alquiler
// del día 3 ya cayó y el seguro del 25 todavía no.
//
// Sin `server-only`, como `topes.ts` y `recurrentes.ts`: es aritmética pura y
// la usa la vista del mes (cliente) sobre datos que ya viajan a la página.
import { fechasEnMes } from '@/lib/recurrentes'

export interface MovimientoPrevision {
  type: 'INGRESO' | 'GASTO'
  amount: number
  expenseDate: string
  /** El recurrente que lo apuntó, si lo apuntó uno. */
  recurringUuid: string | null
}

export interface RecurrentePrevision {
  uuid: string
  type: 'INGRESO' | 'GASTO'
  amount: number
  intervalMonths: number
  nextDate: string
  dayAnchor: number
  active: boolean
}

export interface Prevision {
  /**
   * Un mes PASADO no se prevé: ya se sabe en qué acabó. Uno FUTURO no tiene
   * ritmo del que tirar, así que solo se sabe lo recurrente.
   */
  estado: 'cerrado' | 'en curso' | 'futuro'
  /** Gastado de verdad hasta ahora en el mes. */
  gastado: number
  /** Lo que falta por el RITMO del gasto del día a día. */
  ritmoRestante: number
  /** Recurrentes de gasto que quedan por caer en el mes. */
  porCaer: number
  /** gastado + ritmoRestante + porCaer. */
  previsto: number
  diasTranscurridos: number
  diasDelMes: number
  /** Media diaria del gasto NO recurrente, que es la que se extrapola. */
  mediaDiaria: number
}

const diasDe = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

const redondear = (v: number) => Math.round(v * 100) / 100

/**
 * Previsión del gasto a fin de mes.
 *
 * ⚠ **El ritmo se calcula SOLO sobre el gasto no recurrente**, y es la
 * decisión que hace que la cifra signifique algo. Si se extrapolara el gasto
 * total, el alquiler que cayó el día 3 se multiplicaría por los 30 días del
 * mes: a día 5 la previsión diría que vas a gastar cuatro alquileres. Los
 * recurrentes no siguen un ritmo, tienen fecha — así que se suman aparte y
 * solo los que aún no han caído.
 *
 * Por el mismo motivo, un recurrente que YA cayó no se cuenta dos veces: está
 * dentro de `gastado` y se excluye de `porCaer` mirando su `recurringUuid` en
 * los movimientos del mes.
 */
export function previsionCierre({
  mes, hoy, movimientos, recurrentes,
}: {
  mes: string
  hoy: string
  movimientos: MovimientoPrevision[]
  recurrentes: RecurrentePrevision[]
}): Prevision {
  const diasDelMes = diasDe(mes)
  const mesDeHoy = hoy.slice(0, 7)
  const gastos = movimientos.filter((m) => m.type === 'GASTO')
  const gastado = redondear(gastos.reduce((s, m) => s + m.amount, 0))

  const base = { gastado, diasDelMes, ritmoRestante: 0, porCaer: 0, mediaDiaria: 0 }

  // Mes pasado: ya se sabe en qué acabó. Prever el pasado no es prever.
  if (mes < mesDeHoy) {
    return { ...base, estado: 'cerrado', previsto: gastado, diasTranscurridos: diasDelMes }
  }

  // Los recurrentes de gasto que quedan por caer: los que tienen fecha en el
  // mes, posterior a hoy, y que no han cargado ya.
  const yaCargados = new Set(
    movimientos.map((m) => m.recurringUuid).filter((u): u is string => u !== null),
  )
  const porCaer = redondear(
    recurrentes
      .filter((r) => r.active && r.type === 'GASTO' && !yaCargados.has(r.uuid))
      .reduce((s, r) => {
        const fecha = fechasEnMes(r, mes)[0]
        // En el mes en curso solo cuenta lo que aún no ha llegado; en un mes
        // futuro, todo lo del mes.
        if (!fecha) return s
        if (mes === mesDeHoy && fecha <= hoy) return s
        return s + r.amount
      }, 0),
  )

  // Mes futuro: no hay ritmo que extrapolar (no ha empezado), así que lo único
  // que se puede afirmar es lo recurrente. Inventar una media sería mentir.
  if (mes > mesDeHoy) {
    return {
      ...base, estado: 'futuro', porCaer,
      previsto: redondear(gastado + porCaer), diasTranscurridos: 0,
    }
  }

  const diasTranscurridos = Math.min(diasDelMes, Number(hoy.slice(8, 10)))
  const diasRestantes = diasDelMes - diasTranscurridos
  const variables = gastos.filter((m) => m.recurringUuid === null)

  // ⚠ El ritmo se mide SOLO con lo que ya ha pasado (`expenseDate <= hoy`).
  // Un movimiento con fecha futura —se pueden apuntar por adelantado— no dice
  // nada del ritmo, y meterlo dividía el gasto de medio mes entre los días
  // transcurridos: con datos reales a día 7 la previsión salía cuatro veces el
  // gasto del mes anterior. Se vio en el navegador, no en los tests.
  const hastaHoy = variables
    .filter((m) => m.expenseDate <= hoy)
    .reduce((s, m) => s + m.amount, 0)
  const mediaDiaria = diasTranscurridos > 0 ? redondear(hastaHoy / diasTranscurridos) : 0

  // Y lo ya apuntado CON FECHA FUTURA no se extrapola: se sabe. Se resta de la
  // estimación de los días que quedan (con suelo en 0) para no contarlo dos
  // veces — ya está dentro de `gastado`.
  const futuroApuntado = variables
    .filter((m) => m.expenseDate > hoy)
    .reduce((s, m) => s + m.amount, 0)
  const ritmoRestante = redondear(
    Math.max(0, mediaDiaria * diasRestantes - futuroApuntado),
  )

  return {
    estado: 'en curso',
    gastado,
    ritmoRestante,
    porCaer,
    previsto: redondear(gastado + ritmoRestante + porCaer),
    diasTranscurridos,
    diasDelMes,
    mediaDiaria,
  }
}
