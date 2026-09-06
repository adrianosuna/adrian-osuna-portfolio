// Atajo de login de DESARROLLO: entrar como DEV_LOGIN_EMAIL sin Google. Lo que
// importa probar es que NO PUEDE existir en producción y que, cuando existe,
// pasa por la misma allowlist que Google.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, headersMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    userSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    loginEvent: { create: vi.fn() },
  },
  headersMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/headers', () => ({ headers: headersMock }))

const USUARIO = { uuid: 'u-1', email: 'adrian@gmail.com', role: 'ADMIN', status: 'ACTIVE', name: 'Adrián', picture: null, googleSub: null }

/** Carga `@/auth` de cero con el entorno dado (los providers se construyen al importar). */
async function cargarAuth(env: { NODE_ENV: string; DEV_LOGIN_EMAIL?: string }) {
  vi.resetModules()
  vi.stubEnv('NODE_ENV', env.NODE_ENV)
  if (env.DEV_LOGIN_EMAIL === undefined) vi.stubEnv('DEV_LOGIN_EMAIL', '')
  else vi.stubEnv('DEV_LOGIN_EMAIL', env.DEV_LOGIN_EMAIL)
  const { authConfig } = await import('@/auth')
  return authConfig
}

// `Credentials({ id: 'dev' })` deja el id propio en `options.id` (el objeto
// externo dice 'credentials' hasta que NextAuth lo normaliza al arrancar).
type Prov = { id?: string; options?: { id?: string } }
const idDe = (p: unknown) =>
  typeof p === 'function' ? 'google' : ((p as Prov).options?.id ?? (p as Prov).id ?? '?')
const idsDe = (cfg: { providers: unknown[] }) => cfg.providers.map(idDe)

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findUnique.mockResolvedValue(USUARIO)
})
afterEach(() => vi.unstubAllEnvs())

describe('correoDevLogin (los dos candados)', () => {
  it('en producción es null aunque la variable esté puesta', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEV_LOGIN_EMAIL', 'adrian@gmail.com')
    vi.resetModules()
    const { correoDevLogin } = await import('@/lib/dev-login')
    expect(correoDevLogin()).toBeNull()
  })

  it('sin la variable es null, y con ella devuelve el correo normalizado', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_LOGIN_EMAIL', '')
    vi.resetModules()
    const { correoDevLogin } = await import('@/lib/dev-login')
    expect(correoDevLogin()).toBeNull()
    vi.stubEnv('DEV_LOGIN_EMAIL', '  Adrian@Gmail.com ')
    expect(correoDevLogin()).toBe('adrian@gmail.com')
  })
})

describe('proveedor "dev"', () => {
  it('NO se registra en producción, ni en desarrollo sin la variable', async () => {
    expect(idsDe(await cargarAuth({ NODE_ENV: 'production', DEV_LOGIN_EMAIL: 'adrian@gmail.com' }))).toEqual(['google'])
    expect(idsDe(await cargarAuth({ NODE_ENV: 'development' }))).toEqual(['google'])
  })

  it('se registra en desarrollo con la variable, y sigue la allowlist', async () => {
    const cfg = await cargarAuth({ NODE_ENV: 'development', DEV_LOGIN_EMAIL: 'adrian@gmail.com' })
    expect(idsDe(cfg)).toEqual(['google', 'dev'])
    // Igual que el id: el `authorize` propio vive en `options` hasta que
    // NextAuth normaliza el proveedor; el de fuera es el `() => null` por defecto.
    type Autoriza = (c: unknown, r: unknown) => Promise<unknown>
    const bruto = cfg.providers.find((p) => idDe(p) === 'dev') as unknown as {
      authorize: Autoriza
      options?: { authorize?: Autoriza }
    }
    const dev = { authorize: bruto.options?.authorize ?? bruto.authorize }
    // Usuario de la allowlist → entra con sus datos.
    expect(await dev.authorize({}, {} as never)).toMatchObject({ id: 'u-1', email: 'adrian@gmail.com' })
    // Deshabilitado o inexistente → no.
    prismaMock.user.findUnique.mockResolvedValue({ ...USUARIO, status: 'DISABLED' })
    expect(await dev.authorize({}, {} as never)).toBeNull()
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await dev.authorize({}, {} as never)).toBeNull()
  })

  it('el callback signIn solo deja entrar al atajo como SU correo', async () => {
    const cfg = await cargarAuth({ NODE_ENV: 'development', DEV_LOGIN_EMAIL: 'adrian@gmail.com' })
    const signIn = (args: object) => cfg.callbacks!.signIn!(args as never)
    // Sin `profile` (no hay Google que verifique nada), con su correo: pasa.
    expect(await signIn({ user: { email: 'Adrian@gmail.com' }, account: { provider: 'dev' } })).toBe(true)
    // Con otro correo por el proveedor dev: no, aunque esté en la allowlist.
    expect(await signIn({ user: { email: 'otro@gmail.com' }, account: { provider: 'dev' } })).toBe(false)
  })
})
