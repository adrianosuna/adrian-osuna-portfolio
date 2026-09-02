// Guarda de entorno del planificador: los avisos por correo solo se programan
// en producción. En desarrollo, con SMTP configurado en el .env, arrancar el
// dev server enviaba correos reales (la pasada de arranque salta al minuto).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { cronMock, avisosMock } = vi.hoisted(() => ({
  cronMock: { schedule: vi.fn() },
  avisosMock: {
    avisarVencidas: vi.fn(async () => 0),
    avisarSeguimientos: vi.fn(async () => 0),
    avisarMesSinRellenar: vi.fn(async () => 0),
    avisarTopes: vi.fn(async () => 0),
    generarRecurrentes: vi.fn(async () => 0),
    guardarMuestraInfra: vi.fn(async () => true),
    avisosPendientes: vi.fn(async () => []),
    avisarPush: vi.fn(async () => 0),
  },
}))

vi.mock('node-cron', () => ({ default: cronMock }))
vi.mock('@/lib/correo', () => ({ correoConfigurado: () => true }))
vi.mock('@/lib/mantenimiento', () => ({ avisarVencidas: avisosMock.avisarVencidas }))
vi.mock('@/lib/pipeline', () => ({ avisarSeguimientos: avisosMock.avisarSeguimientos }))
vi.mock('@/lib/finance', () => ({ avisarMesSinRellenar: avisosMock.avisarMesSinRellenar }))
vi.mock('@/lib/gastos', () => ({
  avisarTopes: avisosMock.avisarTopes,
  generarRecurrentes: avisosMock.generarRecurrentes,
}))
// La muestra del monitor cuelga de prisma (y este test no levanta BD).
vi.mock('@/lib/infra-historico', () => ({
  guardarMuestraInfra: avisosMock.guardarMuestraInfra,
}))
// El aviso push lee los avisos pendientes: los dos módulos tocan prisma.
vi.mock('@/lib/inicio', () => ({ avisosPendientes: avisosMock.avisosPendientes }))
vi.mock('@/lib/push', () => ({ avisarPush: avisosMock.avisarPush }))

const entornoOriginal = { ...process.env }

// El módulo guarda un flag en globalThis para sobrevivir al hot-reload, así que
// cada caso necesita módulos frescos y el flag limpio.
async function arrancar(env: Record<string, string | undefined>) {
  delete (globalThis as { __cronIniciado?: boolean }).__cronIniciado
  vi.resetModules()
  Object.assign(process.env, env)
  const { iniciarCron } = await import('@/lib/cron')
  iniciarCron()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  process.env = { ...entornoOriginal }
})

describe('iniciarCron: guarda de entorno', () => {
  it('en desarrollo no programa nada ni hace la pasada de arranque', async () => {
    await arrancar({ NODE_ENV: 'development', CRON_EN_DEV: undefined })
    expect(cronMock.schedule).not.toHaveBeenCalled()
    // La pasada de arranque va con setTimeout: adelantar el reloj no la dispara.
    vi.advanceTimersByTime(120_000)
    await vi.runAllTimersAsync()
    expect(avisosMock.avisarVencidas).not.toHaveBeenCalled()
    expect(avisosMock.avisarSeguimientos).not.toHaveBeenCalled()
    expect(avisosMock.avisarMesSinRellenar).not.toHaveBeenCalled()
    expect(avisosMock.avisarTopes).not.toHaveBeenCalled()
    expect(avisosMock.generarRecurrentes).not.toHaveBeenCalled()
    expect(avisosMock.guardarMuestraInfra).not.toHaveBeenCalled()
    expect(avisosMock.avisarPush).not.toHaveBeenCalled()
  })

  it('en producción programa el diario y dispara la pasada de arranque', async () => {
    await arrancar({ NODE_ENV: 'production', CRON_EN_DEV: undefined })
    expect(cronMock.schedule).toHaveBeenCalledWith('0 8 * * *', expect.any(Function), {
      timezone: 'Europe/Madrid',
    })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(avisosMock.avisarVencidas).toHaveBeenCalledOnce()
    expect(avisosMock.avisarSeguimientos).toHaveBeenCalledOnce()
    expect(avisosMock.avisarMesSinRellenar).toHaveBeenCalledOnce()
    expect(avisosMock.generarRecurrentes).toHaveBeenCalledOnce()
    expect(avisosMock.avisarTopes).toHaveBeenCalledOnce()
    // La muestra del monitor va al margen de los avisos (no depende del correo).
    expect(avisosMock.guardarMuestraInfra).toHaveBeenCalledOnce()
    // Y el push también: es otro canal, no cuelga del SMTP.
    expect(avisosMock.avisarPush).toHaveBeenCalledOnce()
  })

  it('CRON_EN_DEV=1 fuerza los avisos en desarrollo', async () => {
    await arrancar({ NODE_ENV: 'development', CRON_EN_DEV: '1' })
    expect(cronMock.schedule).toHaveBeenCalledOnce()
  })
})
