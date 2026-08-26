// Umbrales del monitor de infraestructura: la lógica que decide si una tarjeta
// sale verde (ok), ámbar (aviso) o roja (error). TLS, sistema de ficheros,
// Prisma y red simulados; el reloj, congelado.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { tlsMock, fsMock, queryRawMock } = vi.hoisted(() => ({
  tlsMock: { connect: vi.fn() },
  fsMock: { readdir: vi.fn(), stat: vi.fn(), statfs: vi.fn(), readFile: vi.fn() },
  queryRawMock: vi.fn(),
}))

vi.mock('node:tls', () => ({ default: tlsMock }))
vi.mock('node:fs/promises', () => ({ default: fsMock }))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: queryRawMock } }))
vi.mock('@/lib/site', () => ({ SITE_URL: 'https://adrianosuna.com' }))

const { snapshotInfra } = await import('@/lib/infra')

const DIA_MS = 86_400_000
const HORA_MS = 3_600_000

// Certificado TLS simulado: `caducaEnDias` desde "ahora"; null = fallo de conexión.
function simularCertificado(caducaEnDias: number | null) {
  tlsMock.connect.mockImplementation((_opts: unknown, cb: () => void) => {
    const socket = {
      getPeerCertificate: () =>
        caducaEnDias === null ? {} : { valid_to: new Date(Date.now() + caducaEnDias * DIA_MS).toUTCString() },
      end: vi.fn(),
      destroy: vi.fn(),
      setTimeout: vi.fn(),
      on: vi.fn((evento: string, handler: (e: Error) => void) => {
        if (evento === 'error' && caducaEnDias === null) queueMicrotask(() => handler(new Error('ECONNREFUSED')))
      }),
    }
    if (caducaEnDias !== null) queueMicrotask(cb)
    return socket
  })
}

// Estado base "todo sano": cada test retoca solo lo que le interesa.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-25T12:00:00Z'))
  vi.clearAllMocks()
  delete process.env.INFRA_BACKUPS_DIR

  simularCertificado(60)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
  queryRawMock.mockImplementation(async (strings: TemplateStringsArray) => {
    const sql = strings.join('?')
    if (sql.includes('VERSION()')) return [{ v: '8.4.5' }]
    if (sql.includes('SHOW GLOBAL STATUS')) {
      return [{ Variable_name: 'Uptime', Value: '3600' }, { Variable_name: 'Threads_connected', Value: '5' }]
    }
    if (sql.includes('max_connections')) return [{ Variable_name: 'max_connections', Value: '151' }]
    if (sql.includes('information_schema')) return [{ tabla: 'user', bytes: 65_536 }]
    return [{ 1: 1 }] // SELECT 1
  })
  // Disco al 50 % (4 KiB de bloque).
  fsMock.statfs.mockResolvedValue({ blocks: 1_000_000, bsize: 4096, bavail: 500_000 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('umbrales del certificado SSL', () => {
  it('60 días → ok · 10 días → aviso (renovación de Caddy rota) · caducado → error', async () => {
    expect((await snapshotInfra()).ssl).toMatchObject({ estado: 'ok', diasRestantes: 60 })
    simularCertificado(10)
    expect((await snapshotInfra()).ssl).toMatchObject({ estado: 'aviso', diasRestantes: 10 })
    simularCertificado(-1)
    expect((await snapshotInfra()).ssl.estado).toBe('error')
  })

  it('si el dominio no responde, error con explicación (no una excepción)', async () => {
    simularCertificado(null)
    const { ssl } = await snapshotInfra()
    expect(ssl.estado).toBe('error')
    expect(ssl.detalle).toContain('No se pudo comprobar')
  })
})

describe('umbrales del backup', () => {
  const conDumps = (edadHorasDelMasNuevo: number) => {
    process.env.INFRA_BACKUPS_DIR = '/backups'
    fsMock.readdir.mockResolvedValue(['portfolio-1.sql.gz', 'portfolio-2.sql.gz', 'notas.txt'])
    fsMock.stat.mockImplementation(async (ruta: string) => ({
      mtimeMs: Date.now() - (ruta.includes('portfolio-1') ? edadHorasDelMasNuevo : 100) * HORA_MS,
      size: 140_000,
    }))
  }

  it('sin configurar (desarrollo) no es una alarma: estado null', async () => {
    expect((await snapshotInfra()).backup.estado).toBeNull()
  })

  it('5 h → ok · 30 h → aviso · 60 h → error, ignorando ficheros ajenos', async () => {
    conDumps(5)
    const { backup } = await snapshotInfra()
    expect(backup).toMatchObject({ estado: 'ok', ficheros: 2 }) // notas.txt fuera
    conDumps(30)
    expect((await snapshotInfra()).backup.estado).toBe('aviso')
    conDumps(60)
    expect((await snapshotInfra()).backup.estado).toBe('error')
  })

  it('carpeta configurada pero vacía → error (el cron no está dejando dumps)', async () => {
    process.env.INFRA_BACKUPS_DIR = '/backups'
    fsMock.readdir.mockResolvedValue([])
    expect((await snapshotInfra()).backup.estado).toBe('error')
  })
})

describe('umbrales del disco', () => {
  const conUso = (pct: number) =>
    fsMock.statfs.mockResolvedValue({ blocks: 100, bsize: 4096, bavail: 100 - pct })

  it('50 % → ok · 85 % → aviso · 95 % → error', async () => {
    conUso(50)
    expect((await snapshotInfra()).disco).toMatchObject({ estado: 'ok', usadoPct: 50 })
    conUso(85)
    expect((await snapshotInfra()).disco.estado).toBe('aviso')
    conUso(95)
    expect((await snapshotInfra()).disco.estado).toBe('error')
  })
})

describe('base de datos y latencia pública', () => {
  it('con MySQL respondiendo: ok, con versión, motor y conexiones', async () => {
    const { db } = await snapshotInfra()
    expect(db).toMatchObject({
      estado: 'ok',
      version: '8.4.5',
      motorUptimeSeg: 3600,
      conexiones: { actual: 5, max: 151 },
    })
  })

  it('con MySQL caído: error sin tumbar el resto de la instantánea', async () => {
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {})
    queryRawMock.mockRejectedValue(new Error('ECONNREFUSED'))
    const snap = await snapshotInfra()
    expect(snap.db.estado).toBe('error')
    expect(snap.almacenBD).toBeNull()
    expect(snap.ssl.estado).toBe('ok') // el resto sigue vivo
    silencio.mockRestore()
  })

  it('la web pública: ok si responde, error si devuelve 5xx o no responde', async () => {
    expect((await snapshotInfra()).web.estado).toBe('ok')

    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 502 })))
    expect((await snapshotInfra()).web).toMatchObject({ estado: 'error', detalle: 'El dominio respondió HTTP 502' })

    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('DNS fail') }))
    expect((await snapshotInfra()).web.estado).toBe('error')
    silencio.mockRestore()
  })
})
