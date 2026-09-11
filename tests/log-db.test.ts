// Sumidero persistente del registro: qué se guarda, qué no, y las tres garantías. El
// import perezoso de `persistir` no es testeable aquí; se verificó en producción.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    logEvent: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { guardarEvento, listLogs, purgarLogs, retencionDias } = await import('@/lib/log-db')
const { log, registrarSumidero } = await import('@/lib/log')

/** Emite por el mismo camino que la aplicación pero con el sumidero de prueba: el
 *  `import()` perezoso resolvería después de la aserción. */
const emitir = () => registrarSumidero(guardarEvento)

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.logEvent.create.mockResolvedValue({})
  process.env.LOG_LEVEL = 'debug'
})
afterEach(() => {
  registrarSumidero(null)
  delete process.env.LOG_RETENCION_DIAS
  delete process.env.LOG_LEVEL
})

/** El `data` con el que se llamó a create, ya parseado. */
const datosGuardados = (i = 0) => {
  const bruto = prismaMock.logEvent.create.mock.calls[i][0].data.data as string | null
  return bruto === null ? null : (JSON.parse(bruto) as Record<string, unknown>)
}

describe('qué se guarda y qué no', () => {
  beforeEach(emitir)
  it('solo warn y error: info y debug se quedan en la consola', () => {
    log.debug('t', 'depurando')
    log.info('t', 'informando')
    expect(prismaMock.logEvent.create).not.toHaveBeenCalled()
    log.warn('t', 'avisando')
    log.error('t', 'reventando')
    expect(prismaMock.logEvent.create).toHaveBeenCalledTimes(2)
    // `info` es una línea por pasada del cron y por login: guardarlo convierte
    // la tabla en un vertedero donde el error de verdad no se encuentra.
    expect(prismaMock.logEvent.create.mock.calls.map((c) => c[0].data.level)).toEqual([
      'warn', 'error',
    ])
  })

  it('no hace falta enganchar nada: el nivel decide', () => {
    // Sin sumidero de prueba, `log.ts` carga `log-db` por su cuenta. Solo se comprueba
    // que no lanza; que escribe se verificó contra producción.
    registrarSumidero(null)
    expect(() => log.info('t', 'informando')).not.toThrow()
    expect(() => log.error('t', 'reventando')).not.toThrow()
  })

  it('guarda la TRAZA del error, al contrario que la consola de producción', () => {
    // En consola se omite la traza; esta tabla es privada del admin y ahí sí sirve.
    const e = new Error('la BD se fue')
    log.error('api', 'consulta fallida', { error: e })
    const guardado = datosGuardados()!.error as Record<string, string>
    expect(guardado.error).toBe('Error')
    expect(guardado.mensaje).toBe('la BD se fue')
    expect(guardado.traza).toContain('Error: la BD se fue')
  })

  it('un evento sin datos guarda null, no un objeto vacío', () => {
    log.warn('t', 'solo el mensaje')
    expect(prismaMock.logEvent.create.mock.calls[0][0].data.data).toBeNull()
  })

  it('recorta mensaje y scope a lo que cabe en la columna', () => {
    log.error('s'.repeat(200), 'm'.repeat(900))
    const d = prismaMock.logEvent.create.mock.calls[0][0].data
    expect(d.scope).toHaveLength(60)
    expect(d.message).toHaveLength(500)
  })

  it('unos datos que no se pueden serializar no cuestan el evento', () => {
    const ciclo: Record<string, unknown> = {}
    ciclo.yo = ciclo
    log.error('t', 'con un ciclo dentro', { ciclo })
    expect(prismaMock.logEvent.create).toHaveBeenCalledTimes(1)
    expect(datosGuardados()).toMatchObject({ aviso: expect.stringContaining('no se pudieron') })
  })
})

describe('las tres garantías del sumidero', () => {
  it('si la BD falla, el log NO lanza', () => {
    emitir()
    prismaMock.logEvent.create.mockRejectedValue(new Error('sin conexión'))
    // Lo que se estaba haciendo no puede caerse porque el registro falle.
    expect(() => log.error('api', 'algo', { a: 1 })).not.toThrow()
  })

  it('un sumidero que lanza en síncrono tampoco tumba nada', () => {
    registrarSumidero(() => {
      throw new Error('sumidero roto')
    })
    expect(() => log.warn('t', 'algo')).not.toThrow()
  })

  it('no RE-ENTRA: un log desde dentro del sumidero no vuelve a entrar', () => {
    // Es el bucle que se comería el proceso justo cuando la BD está caída: el
    // sumidero falla, lo registra, y eso vuelve a llamar al sumidero.
    let veces = 0
    registrarSumidero(() => {
      veces++
      log.error('sumidero', 'yo también registro')
    })
    log.error('t', 'el primero')
    expect(veces).toBe(1)
  })
})

describe('retención y purga', () => {
  it('30 días por defecto, y la variable manda', () => {
    expect(retencionDias()).toBe(30)
    process.env.LOG_RETENCION_DIAS = '7'
    expect(retencionDias()).toBe(7)
    // Una basura no rompe: se vuelve al defecto.
    process.env.LOG_RETENCION_DIAS = 'lo-que-sea'
    expect(retencionDias()).toBe(30)
  })

  it('con 0 no purga nada (retención desactivada)', async () => {
    process.env.LOG_RETENCION_DIAS = '0'
    expect(await purgarLogs()).toBe(0)
    expect(prismaMock.logEvent.deleteMany).not.toHaveBeenCalled()
  })

  it('purga por fecha y devuelve cuántos borró', async () => {
    prismaMock.logEvent.deleteMany.mockResolvedValue({ count: 12 })
    expect(await purgarLogs()).toBe(12)
    const corte = prismaMock.logEvent.deleteMany.mock.calls[0][0].where.createTs.lt as Date
    const dias = (Date.now() - corte.getTime()) / 86_400_000
    expect(dias).toBeGreaterThan(29.9)
    expect(dias).toBeLessThan(30.1)
  })
})

describe('listLogs', () => {
  beforeEach(() => {
    prismaMock.logEvent.findMany.mockResolvedValue([])
    prismaMock.logEvent.count.mockResolvedValue(0)
    prismaMock.logEvent.groupBy.mockResolvedValue([])
  })

  it('el filtro de NIVEL no entra en las cuentas por nivel', async () => {
    // Si entrara, la vista "solo errores" diría que hay 0 avisos y no habría
    // forma de volver: el contador es justo el botón para salir del filtro.
    await listLogs({ nivel: 'error', dias: 7 })
    // La lista y el total SÍ llevan el nivel...
    expect(prismaMock.logEvent.count.mock.calls[0][0].where.level).toBe('error')
    // ...y los dos groupBy (cuentas por nivel y scopes presentes) NO.
    for (const [args] of prismaMock.logEvent.groupBy.mock.calls) {
      expect((args.where as Record<string, unknown>).level).toBeUndefined()
      expect((args.where as Record<string, unknown>).createTs).toBeDefined()
    }
  })

  it('sin `dias` no acota por fecha; con `dias` sí', async () => {
    await listLogs({})
    expect(prismaMock.logEvent.count.mock.calls[0][0].where.createTs).toBeUndefined()
    vi.clearAllMocks()
    prismaMock.logEvent.findMany.mockResolvedValue([])
    prismaMock.logEvent.count.mockResolvedValue(0)
    prismaMock.logEvent.groupBy.mockResolvedValue([])
    await listLogs({ dias: 1 })
    expect(prismaMock.logEvent.count.mock.calls[0][0].where.createTs.gte).toBeInstanceOf(Date)
  })

  it('un `data` recortado (ya no es JSON) se enseña crudo en vez de perderse', async () => {
    prismaMock.logEvent.findMany.mockResolvedValue([
      {
        uuid: 'l1', level: 'error', scope: 'api', message: 'x',
        data: '{"a":1…(recortado)', createTs: new Date('2026-09-07T10:00:00Z'),
      },
    ])
    const { filas } = await listLogs({})
    expect(filas[0].datos).toMatchObject({ crudo: expect.stringContaining('recortado') })
  })
})
