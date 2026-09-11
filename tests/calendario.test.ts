// Calendario unificado: la aritmética de proyectar tres fuentes a un mes. Puro:
// meses cortos, cruce de año y atraso son donde se rompe.
import { describe, expect, it } from 'vitest'
import {
  eventosDelMes, porDia, semanasDelMes,
  type RecurrenteCal, type SeguimientoCal, type TareaCal,
} from '@/lib/calendario'

/** Espacio irrompible: es el que Intl pone entre la cifra y el €. */
const NB = String.fromCharCode(0x00a0)

// Fixtures con factoría: cada caso declara solo lo que le importa.
const tarea = (p: Partial<TareaCal> = {}): TareaCal => ({
  uuid: 't1', title: 'ITV', scopeName: 'Vehículo', intervalMonths: 12,
  nextDue: '2026-09-20', lastDone: null, ...p,
})
const recurrente = (p: Partial<RecurrenteCal> = {}): RecurrenteCal => ({
  uuid: 'r1', concept: 'Alquiler', type: 'GASTO', amount: 720,
  intervalMonths: 1, nextDate: '2026-09-03', dayAnchor: 3, active: true, ...p,
})
const seguimiento = (p: Partial<SeguimientoCal> = {}): SeguimientoCal => ({
  uuid: 'o1', title: 'Web corporativa', company: 'ACME',
  nextAction: 'Llamar', nextActionDate: '2026-09-15', archived: false, ...p,
})

describe('eventosDelMes', () => {
  it('reúne las tres fuentes en el mismo mes, ordenadas por día', () => {
    const e = eventosDelMes('2026-09', '2026-09-05', {
      tareas: [tarea()],
      recurrentes: [recurrente()],
      seguimientos: [seguimiento()],
    })
    expect(e.map((x) => [x.fecha, x.tipo])).toEqual([
      ['2026-09-03', 'recurrente'],
      ['2026-09-15', 'seguimiento'],
      ['2026-09-20', 'mantenimiento'],
    ])
  })

  it('una serie mensual sale una vez por mes; una anual, solo en el suyo', () => {
    const mensual = eventosDelMes('2026-11', '2026-09-05', { recurrentes: [recurrente()] })
    expect(mensual.map((x) => x.fecha)).toEqual(['2026-11-03'])
    const anual = eventosDelMes('2026-11', '2026-09-05', { tareas: [tarea()] })
    expect(anual).toHaveLength(0)
    expect(eventosDelMes('2027-09', '2026-09-05', { tareas: [tarea()] }).map((x) => x.fecha)).toEqual([
      '2027-09-20',
    ])
  })

  it('el ancla del día sobrevive a febrero (un recibo del 31 no se clava en el 28)', () => {
    const r = recurrente({ nextDate: '2027-01-31', dayAnchor: 31 })
    expect(eventosDelMes('2027-02', '2027-01-01', { recurrentes: [r] }).map((x) => x.fecha)).toEqual([
      '2027-02-28',
    ])
    // Y en marzo vuelve al 31, que es la gracia del ancla.
    expect(eventosDelMes('2027-03', '2027-01-01', { recurrentes: [r] }).map((x) => x.fecha)).toEqual([
      '2027-03-31',
    ])
  })

  it('un recordatorio puntual sale UNA vez y no encadena serie', () => {
    const t = tarea({ intervalMonths: null, nextDue: '2027-03-12' })
    expect(eventosDelMes('2027-03', '2026-09-05', { tareas: [t] })).toHaveLength(1)
    expect(eventosDelMes('2027-04', '2026-09-05', { tareas: [t] })).toHaveLength(0)
  })

  it('una tarea VENCIDA se arrastra a hoy, y solo en el mes en curso', () => {
    const t = tarea({ intervalMonths: null, nextDue: '2026-07-01' })
    const enCurso = eventosDelMes('2026-09', '2026-09-05', { tareas: [t] })
    expect(enCurso).toHaveLength(1)
    expect(enCurso[0]).toMatchObject({ fecha: '2026-09-05', atrasado: true })
    // Mirando octubre no aparece: no vence ahí, y ya se vio en el mes en curso.
    expect(eventosDelMes('2026-10', '2026-09-05', { tareas: [t] })).toHaveLength(0)
  })

  it('una tarea vencida DENTRO del mes se queda en su día, pero marcada', () => {
    // Vencida el día 3 estando hoy a 5: no se arrastra (su día se ve) pero sigue
    // vencida.
    const t = tarea({ intervalMonths: null, nextDue: '2026-09-03' })
    const e = eventosDelMes('2026-09', '2026-09-05', { tareas: [t] })
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ fecha: '2026-09-03', atrasado: true })
  })

  it('una tarea futura del mismo mes NO está atrasada', () => {
    const t = tarea({ intervalMonths: null, nextDue: '2026-09-20' })
    const e = eventosDelMes('2026-09', '2026-09-05', { tareas: [t] })
    expect(e[0]).toMatchObject({ fecha: '2026-09-20', atrasado: false })
  })

  it('una tarea PUNTUAL ya hecha no sale: su fecha no avanza nunca', () => {
    // Sin esto se arrastraba a hoy como vencida para siempre — el mismo fallo
    // que tenían la lista, los avisos del inicio y el correo del cron.
    const t = tarea({ intervalMonths: null, nextDue: '2026-07-01', lastDone: '2026-07-02' })
    expect(eventosDelMes('2026-09', '2026-09-05', { tareas: [t] })).toHaveLength(0)
    // Una que se REPITE es otra cosa: hecha o no, su próximo vencimiento vale.
    const r = tarea({ intervalMonths: 1, nextDue: '2026-09-10', lastDone: '2026-08-10' })
    expect(eventosDelMes('2026-09', '2026-09-05', { tareas: [r] })).toHaveLength(1)
  })

  it('un cargo atrasado NO se arrastra: lo apunta el cron, no Adrián', () => {
    // Diferencia deliberada con las tareas: no es algo que él tenga que hacer.
    const r = recurrente({ nextDate: '2026-08-03' })
    const e = eventosDelMes('2026-09', '2026-09-05', { recurrentes: [r] })
    expect(e.every((x) => !x.atrasado)).toBe(true)
    expect(e.map((x) => x.fecha)).toEqual(['2026-09-03'])
  })

  it('un recurrente en pausa no es una previsión: no sale', () => {
    expect(eventosDelMes('2026-09', '2026-09-05', { recurrentes: [recurrente({ active: false })] })).toHaveLength(0)
  })

  it('un seguimiento archivado o sin fecha no sale; uno pasado sale marcado', () => {
    expect(eventosDelMes('2026-09', '2026-09-05', { seguimientos: [seguimiento({ archived: true })] })).toHaveLength(0)
    expect(eventosDelMes('2026-09', '2026-09-05', { seguimientos: [seguimiento({ nextActionDate: null })] })).toHaveLength(0)
    const pasado = eventosDelMes('2026-09', '2026-09-20', { seguimientos: [seguimiento()] })
    expect(pasado[0]).toMatchObject({ fecha: '2026-09-15', atrasado: true })
  })

  it('dentro de un día, lo atrasado va primero', () => {
    // Una tarea vencida en junio se arrastra a hoy; un seguimiento que vence
    // HOY no está atrasado (hoy todavía cuenta), así que va después.
    const e = eventosDelMes('2026-09', '2026-09-15', {
      tareas: [tarea({ intervalMonths: null, nextDue: '2026-06-01' })],
      seguimientos: [seguimiento({ nextActionDate: '2026-09-15' })],
    })
    const hoy = e.filter((x) => x.fecha === '2026-09-15')
    expect(hoy.map((x) => [x.tipo, x.atrasado])).toEqual([
      ['mantenimiento', true],
      ['seguimiento', false],
    ])
  })

  it('el detalle de un recurrente lleva el signo y agrupa los miles', () => {
    const [gasto] = eventosDelMes('2026-09', '2026-09-01', { recurrentes: [recurrente()] })
    expect(gasto.detalle).toBe(`−720${NB}€`)
    // ⚠ es-ES no agrupa 4 cifras por defecto: sin el formateador compartido
    // esto salía "1850 €" al lado de un "12.750 €".
    const [ingreso] = eventosDelMes('2026-09', '2026-09-01', {
      recurrentes: [recurrente({ type: 'INGRESO', amount: 1850 })],
    })
    expect(ingreso.detalle).toBe(`+1.850${NB}€`)
  })
})

describe('porDia', () => {
  it('agrupa por fecha conservando el orden', () => {
    const e = eventosDelMes('2026-09', '2026-09-01', {
      recurrentes: [recurrente(), recurrente({ uuid: 'r2', concept: 'Nómina', nextDate: '2026-09-03' })],
    })
    const m = porDia(e)
    expect(m.get('2026-09-03')).toHaveLength(2)
    expect(m.get('2026-09-04')).toBeUndefined()
  })
})

describe('semanasDelMes', () => {
  it('siempre semanas completas de 7 días empezando en lunes', () => {
    for (const mes of ['2026-09', '2026-02', '2027-02', '2026-11', '2026-08']) {
      const s = semanasDelMes(mes)
      expect(s.every((w) => w.length === 7), mes).toBe(true)
      // El primer día de la rejilla es lunes.
      expect(new Date(`${s[0][0].fecha}T00:00:00Z`).getUTCDay(), mes).toBe(1)
    }
  })

  it('marca qué días son del mes y rellena los vecinos', () => {
    // Septiembre de 2026 empieza en martes: un hueco delante.
    const s = semanasDelMes('2026-09')
    expect(s[0][0]).toEqual({ fecha: '2026-08-31', delMes: false })
    expect(s[0][1]).toEqual({ fecha: '2026-09-01', delMes: true })
    const delMes = s.flat().filter((c) => c.delMes)
    expect(delMes).toHaveLength(30)
    expect(delMes.at(-1)!.fecha).toBe('2026-09-30')
  })

  it('febrero bisiesto tiene sus 29 días', () => {
    expect(semanasDelMes('2028-02').flat().filter((c) => c.delMes)).toHaveLength(29)
  })
})
