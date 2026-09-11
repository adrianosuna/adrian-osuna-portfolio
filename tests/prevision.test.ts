// Previsión de cierre de mes. La trampa que decide si la cifra vale algo: el
// ritmo se extrapola SOLO sobre el gasto no recurrente. Extrapolando el total,
// el alquiler del día 3 se multiplicaría por los días del mes y a día 5 la
// previsión diría que vas a gastar cuatro alquileres.
import { describe, expect, it } from 'vitest'
import { previsionCierre, type MovimientoPrevision, type RecurrentePrevision } from '@/lib/prevision'

const mov = (p: Partial<MovimientoPrevision> = {}): MovimientoPrevision => ({
  type: 'GASTO', amount: 10, expenseDate: '2026-09-02', recurringUuid: null, ...p,
})
const rec = (p: Partial<RecurrentePrevision> = {}): RecurrentePrevision => ({
  uuid: 'r1', type: 'GASTO', amount: 720, intervalMonths: 1,
  nextDate: '2026-09-25', dayAnchor: 25, active: true, ...p,
})

/** Mes en curso: 30 días, hoy el 10 (quedan 20). */
const base = { mes: '2026-09', hoy: '2026-09-10' }

describe('previsionCierre: el ritmo', () => {
  it('extrapola la media diaria del gasto variable a los días que quedan', () => {
    // 200 € en 10 días = 20 €/día · 20 días por delante = 400 € más.
    const movimientos = [mov({ amount: 200 })]
    const p = previsionCierre({ ...base, movimientos, recurrentes: [] })
    expect(p.estado).toBe('en curso')
    expect(p.diasTranscurridos).toBe(10)
    expect(p.diasDelMes).toBe(30)
    expect(p.mediaDiaria).toBe(20)
    expect(p.ritmoRestante).toBe(400)
    expect(p.previsto).toBe(600)
  })

  it('⚠ un recurrente YA cargado NO entra en el ritmo', () => {
    // Es el fallo que haría la cifra absurda. 200 € variables + un alquiler de
    // 720 ya cargado: el ritmo son 20 €/día (no 92), así que la previsión es
    // 920 + 400 y no 920 + 1.840.
    const movimientos = [
      mov({ amount: 200 }),
      mov({ amount: 720, recurringUuid: 'r1', expenseDate: '2026-09-03' }),
    ]
    const p = previsionCierre({ ...base, movimientos, recurrentes: [rec({ nextDate: '2026-10-03' })] })
    expect(p.gastado).toBe(920)
    expect(p.mediaDiaria).toBe(20)
    expect(p.ritmoRestante).toBe(400)
    // Y tampoco se cuenta otra vez como "por caer": ya está en `gastado`.
    expect(p.porCaer).toBe(0)
    expect(p.previsto).toBe(1320)
  })

  it('los ingresos no cuentan: esto prevé el GASTO', () => {
    const movimientos = [mov({ amount: 100 }), mov({ type: 'INGRESO', amount: 1850 })]
    const p = previsionCierre({ ...base, movimientos, recurrentes: [] })
    expect(p.gastado).toBe(100)
  })
})

describe('previsionCierre: los recurrentes por caer', () => {
  it('suma los que aún no han llegado en el mes', () => {
    const p = previsionCierre({
      ...base,
      movimientos: [mov({ amount: 100 })],
      recurrentes: [rec()], // 720 € el día 25, y hoy es 10
    })
    expect(p.porCaer).toBe(720)
    expect(p.previsto).toBe(100 + 200 + 720)
  })

  it('no suma los de fecha ya pasada: los apunta el cron, no el ritmo', () => {
    const p = previsionCierre({
      ...base,
      movimientos: [mov({ amount: 100 })],
      recurrentes: [rec({ nextDate: '2026-09-03', dayAnchor: 3 })],
    })
    expect(p.porCaer).toBe(0)
  })

  it('ni los pausados, ni los de ingreso, ni los de otro mes', () => {
    const p = previsionCierre({
      ...base,
      movimientos: [],
      recurrentes: [
        rec({ uuid: 'a', active: false }),
        rec({ uuid: 'b', type: 'INGRESO', amount: 1850 }),
        // Anual de marzo: no carga en septiembre.
        rec({ uuid: 'c', intervalMonths: 12, nextDate: '2027-03-12', dayAnchor: 12 }),
      ],
    })
    expect(p.porCaer).toBe(0)
  })
})

describe('previsionCierre: los tres estados del mes', () => {
  it('un mes PASADO no se prevé: ya se sabe en qué acabó', () => {
    const p = previsionCierre({
      mes: '2026-08', hoy: '2026-09-10',
      movimientos: [mov({ amount: 1500, expenseDate: '2026-08-04' })],
      recurrentes: [rec()],
    })
    expect(p.estado).toBe('cerrado')
    expect(p.previsto).toBe(1500)
    expect(p.ritmoRestante).toBe(0)
    expect(p.porCaer).toBe(0)
    expect(p.diasTranscurridos).toBe(31)
  })

  it('un mes FUTURO solo sabe lo recurrente: no hay ritmo que extrapolar', () => {
    // Inventar una media diaria de un mes que no ha empezado sería mentir.
    const p = previsionCierre({
      mes: '2026-10', hoy: '2026-09-10',
      movimientos: [],
      recurrentes: [rec({ nextDate: '2026-10-25' })],
    })
    expect(p.estado).toBe('futuro')
    expect(p.mediaDiaria).toBe(0)
    expect(p.ritmoRestante).toBe(0)
    expect(p.porCaer).toBe(720)
    expect(p.previsto).toBe(720)
  })

  it('el día 1 no divide por cero, y el último día no extrapola nada', () => {
    const uno = previsionCierre({
      mes: '2026-09', hoy: '2026-09-01',
      movimientos: [mov({ amount: 30, expenseDate: '2026-09-01' })],
      recurrentes: [],
    })
    expect(uno.mediaDiaria).toBe(30)
    expect(uno.ritmoRestante).toBe(30 * 29)

    const ultimo = previsionCierre({
      mes: '2026-09', hoy: '2026-09-30',
      movimientos: [mov({ amount: 300 })],
      recurrentes: [],
    })
    expect(ultimo.ritmoRestante).toBe(0)
    expect(ultimo.previsto).toBe(300)
  })

  it('febrero bisiesto cuenta sus 29 días', () => {
    const p = previsionCierre({
      mes: '2028-02', hoy: '2028-02-10',
      movimientos: [mov({ amount: 100, expenseDate: '2028-02-01' })],
      recurrentes: [],
    })
    expect(p.diasDelMes).toBe(29)
    expect(p.ritmoRestante).toBe(10 * 19)
  })
})
