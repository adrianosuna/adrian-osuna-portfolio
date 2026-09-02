// Los dos plazos de la sesión: tope absoluto y cierre por inactividad.
//
// Se prueba con el módulo recargado por cada caso porque las constantes se
// resuelven al importar (son valores, no funciones): un test que cambie el
// entorno tiene que volver a importar para verlo.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const original = {
  dias: process.env.SESION_DIAS,
  horas: process.env.SESION_INACTIVIDAD_HORAS,
}

const cargar = async (entorno: Record<string, string | undefined> = {}) => {
  for (const [k, v] of Object.entries(entorno)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  vi.resetModules()
  return import('@/lib/sesion-caducidad')
}

beforeEach(() => {
  delete process.env.SESION_DIAS
  delete process.env.SESION_INACTIVIDAD_HORAS
})

afterEach(() => {
  if (original.dias === undefined) delete process.env.SESION_DIAS
  else process.env.SESION_DIAS = original.dias
  if (original.horas === undefined) delete process.env.SESION_INACTIVIDAD_HORAS
  else process.env.SESION_INACTIVIDAD_HORAS = original.horas
})

describe('valores por defecto', () => {
  it('7 días de tope y 48 horas de inactividad', async () => {
    const m = await cargar()
    expect(m.DIAS_SESION).toBe(7)
    expect(m.HORAS_INACTIVIDAD).toBe(48)
    expect(m.SEGUNDOS_SESION).toBe(7 * 24 * 60 * 60)
  })

  it('los lee del entorno cuando están puestos', async () => {
    const m = await cargar({ SESION_DIAS: '3', SESION_INACTIVIDAD_HORAS: '12' })
    expect(m.DIAS_SESION).toBe(3)
    expect(m.HORAS_INACTIVIDAD).toBe(12)
    expect(m.SEGUNDOS_SESION).toBe(3 * 86_400)
  })

  it('ignora valores imposibles y se queda con el defecto', async () => {
    // Un 0 en los días dejaría la sesión muerta al nacer; un 400 la haría
    // eterna. Fuera de rango = como si no estuviera puesto.
    expect((await cargar({ SESION_DIAS: '0' })).DIAS_SESION).toBe(7)
    expect((await cargar({ SESION_DIAS: '400' })).DIAS_SESION).toBe(7)
    expect((await cargar({ SESION_DIAS: 'siempre' })).DIAS_SESION).toBe(7)
    expect((await cargar({ SESION_DIAS: '2.5' })).DIAS_SESION).toBe(7)
    expect((await cargar({ SESION_DIAS: '' })).DIAS_SESION).toBe(7)
  })
})

describe('inactividad', () => {
  const AHORA = new Date('2026-09-02T12:00:00Z').getTime()

  it('cierra una sesión que lleva más del plazo sin actividad', async () => {
    const { inactivaDemasiado } = await cargar({ SESION_INACTIVIDAD_HORAS: '48' })
    const hace49h = new Date(AHORA - 49 * 3_600_000)
    const hace47h = new Date(AHORA - 47 * 3_600_000)
    expect(inactivaDemasiado(hace49h, AHORA)).toBe(true)
    expect(inactivaDemasiado(hace47h, AHORA)).toBe(false)
  })

  it('con 0 no cierra nada por inactividad (el tope absoluto sigue)', async () => {
    const m = await cargar({ SESION_INACTIVIDAD_HORAS: '0' })
    expect(m.HORAS_INACTIVIDAD).toBe(0)
    expect(m.inactivaDemasiado(new Date(AHORA - 365 * 86_400_000), AHORA)).toBe(false)
  })

  it('el plazo va en horas, muy por encima del freno de 5 min de last_seen', async () => {
    // Si el umbral bajara del freno con el que se refresca `last_seen`, se
    // cerrarían sesiones que están en uso.
    const { HORAS_INACTIVIDAD } = await cargar()
    expect(HORAS_INACTIVIDAD * 60).toBeGreaterThan(5)
  })
})

describe('tope absoluto', () => {
  it('el límite es la fecha de hace N días', async () => {
    const { limiteAbsoluto } = await cargar({ SESION_DIAS: '7' })
    const ahora = new Date('2026-09-10T00:00:00Z').getTime()
    expect(limiteAbsoluto(ahora).toISOString()).toBe('2026-09-03T00:00:00.000Z')
  })
})

describe('texto de la política', () => {
  it('nombra los dos plazos, y solo uno si la inactividad está desactivada', async () => {
    const conDos = await cargar({ SESION_DIAS: '7', SESION_INACTIVIDAD_HORAS: '48' })
    expect(conDos.textoCaducidad()).toBe(
      'Las sesiones caducan a los 7 días y tras 48 horas sin actividad',
    )
    const soloUno = await cargar({ SESION_DIAS: '1', SESION_INACTIVIDAD_HORAS: '0' })
    expect(soloUno.textoCaducidad()).toBe('Las sesiones caducan a los 1 día')
  })
})
