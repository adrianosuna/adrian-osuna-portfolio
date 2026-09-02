// Registro por niveles: el suelo configurable, el formato JSON de producción y
// la normalización de un Error (que `JSON.stringify` deja en `{}`).
//
// Interesa porque es la pieza por la que pasan TODOS los avisos del servidor:
// un suelo mal leído silencia el log entero, y un Error serializado a `{}`
// convierte un fallo depurable en una línea inútil.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const original = { LOG_LEVEL: process.env.LOG_LEVEL, NODE_ENV: process.env.NODE_ENV }

// `process.env` de Node rechaza defineProperty con descriptores parciales, y
// `NODE_ENV` es readonly en los tipos: se asigna con un cast al índice.
const setEntorno = (valor: string) => {
  ;(process.env as Record<string, string>).NODE_ENV = valor
}

beforeEach(() => {
  vi.restoreAllMocks()
  delete process.env.LOG_LEVEL
})

afterEach(() => {
  if (original.LOG_LEVEL === undefined) delete process.env.LOG_LEVEL
  else process.env.LOG_LEVEL = original.LOG_LEVEL
  setEntorno(original.NODE_ENV ?? 'test')
})

describe('nivel mínimo', () => {
  it('respeta LOG_LEVEL', async () => {
    const { nivelMinimo, registra } = await import('@/lib/log')
    process.env.LOG_LEVEL = 'warn'
    expect(nivelMinimo()).toBe('warn')
    expect(registra('debug')).toBe(false)
    expect(registra('info')).toBe(false)
    expect(registra('warn')).toBe(true)
    expect(registra('error')).toBe(true)
  })

  it('ignora un LOG_LEVEL inventado y cae al del entorno', async () => {
    const { nivelMinimo } = await import('@/lib/log')
    process.env.LOG_LEVEL = 'chatty'
    setEntorno('production')
    expect(nivelMinimo()).toBe('info')
    setEntorno('development')
    expect(nivelMinimo()).toBe('debug')
  })

  it('en producción calla los debug; en desarrollo los deja pasar', async () => {
    const { registra } = await import('@/lib/log')
    setEntorno('production')
    expect(registra('debug')).toBe(false)
    setEntorno('development')
    expect(registra('debug')).toBe(true)
  })
})

describe('salida', () => {
  it('en producción emite UNA línea JSON con scope, nivel y campos', async () => {
    const { log } = await import('@/lib/log')
    setEntorno('production')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    log.info('cron', 'recurrentes apuntados', { movimientos: 3 })

    expect(spy).toHaveBeenCalledTimes(1)
    const linea = spy.mock.calls[0][0] as string
    const obj = JSON.parse(linea)
    expect(obj.nivel).toBe('info')
    expect(obj.scope).toBe('cron')
    expect(obj.mensaje).toBe('recurrentes apuntados')
    expect(obj.movimientos).toBe(3)
    expect(typeof obj.ts).toBe('string')
  })

  it('warn y error van a stderr (console.error), no a stdout', async () => {
    const { log } = await import('@/lib/log')
    setEntorno('production')
    const salida = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {})

    log.warn('push', 'sin claves')
    log.error('push', 'envío fallido')

    expect(errores).toHaveBeenCalledTimes(2)
    expect(salida).not.toHaveBeenCalled()
  })

  it('un Error se serializa con su nombre y mensaje (no como {})', async () => {
    const { log } = await import('@/lib/log')
    setEntorno('production')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    log.error('api', 'falló', { error: new TypeError('roto') })

    const obj = JSON.parse(spy.mock.calls[0][0] as string)
    expect(obj.error.error).toBe('TypeError')
    expect(obj.error.mensaje).toBe('roto')
    // La traza no viaja en producción: es ruido y delata rutas del sistema.
    expect(obj.error.traza).toBeUndefined()
  })

  it('en desarrollo la traza SÍ aparece (es la que se usa para depurar)', async () => {
    const { log } = await import('@/lib/log')
    setEntorno('development')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    log.error('api', 'falló', { error: new Error('roto') })

    const datos = spy.mock.calls[0][1] as { error: { traza?: string } }
    expect(datos.error.traza).toContain('Error')
  })

  it('por debajo del suelo no escribe nada', async () => {
    const { log } = await import('@/lib/log')
    process.env.LOG_LEVEL = 'error'
    const salida = vi.spyOn(console, 'log').mockImplementation(() => {})

    log.debug('x', 'a')
    log.info('x', 'b')

    expect(salida).not.toHaveBeenCalled()
  })
})
