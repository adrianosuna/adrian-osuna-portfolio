// Callbacks de autenticación (la lógica de seguridad del sitio): allowlist con
// correo verificado, reverificación del usuario en cada petición, registro de
// sesiones (alta en login, cierre remoto al borrar la fila, freno de last_seen)
// e invalidación de JWT antiguos sin registro.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, headersMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    userSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  },
  headersMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/headers', () => ({ headers: headersMock }))

const { authConfig } = await import('@/auth')

const USUARIO = { uuid: 'u-1', role: 'ADMIN', status: 'ACTIVE', name: 'Adrián', picture: null, googleSub: 'sub-1' }

// Los tipos de los callbacks de NextAuth son más anchos que estos fixtures.
const jwt = (args: object) => authConfig.callbacks!.jwt!(args as never)
const signIn = (args: object) => authConfig.callbacks!.signIn!(args as never)
const session = (args: object) => authConfig.callbacks!.session!(args as never)

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findUnique.mockResolvedValue(USUARIO)
  prismaMock.userSession.create.mockResolvedValue({ uuid: 'ses-nueva' })
  prismaMock.userSession.deleteMany.mockResolvedValue({ count: 1 })
  headersMock.mockResolvedValue(new Headers({ 'user-agent': 'Mozilla/5.0 Chrome/128' }))
})

describe('callback signIn (allowlist)', () => {
  it('rechaza sin correo o con correo de Google sin verificar', async () => {
    expect(await signIn({ user: {}, profile: { email_verified: true } })).toBe(false)
    expect(await signIn({ user: { email: 'a@b.com' }, profile: { email_verified: false } })).toBe(false)
  })

  it('rechaza correos fuera de la allowlist o deshabilitados', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await signIn({ user: { email: 'intruso@gmail.com' }, profile: { email_verified: true } })).toBe(false)
    prismaMock.user.findUnique.mockResolvedValue({ ...USUARIO, status: 'DISABLED' })
    expect(await signIn({ user: { email: 'a@b.com' }, profile: { email_verified: true } })).toBe(false)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('normaliza a minúsculas y activa al invitado en su primer login', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USUARIO, status: 'INVITED' })
    const res = await signIn({
      user: { email: 'Nuevo@Gmail.COM', name: 'Nuevo', image: 'http://foto' },
      profile: { email_verified: true, sub: 'g-123' },
    })
    expect(res).toBe(true)
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: 'nuevo@gmail.com' } })
    const update = prismaMock.user.update.mock.calls[0][0]
    expect(update.where).toEqual({ email: 'nuevo@gmail.com' })
    expect(update.data).toMatchObject({ status: 'ACTIVE', name: 'Nuevo', googleSub: 'g-123' })
    expect(update.data.lastLogin).toBeInstanceOf(Date)
  })
})

describe('callback jwt (reverificación + registro de sesiones)', () => {
  it('en el login registra la sesión con el user-agent y guarda su uuid en el token', async () => {
    const token = await jwt({ token: {}, user: { email: 'a@b.com' } })
    expect(token).toMatchObject({ uuid: 'u-1', role: 'ADMIN', sessionUuid: 'ses-nueva' })
    expect(prismaMock.userSession.create).toHaveBeenCalledWith({
      data: { userUuid: 'u-1', userAgent: 'Mozilla/5.0 Chrome/128' },
    })
  })

  it('si el alta de la sesión falla, el login NO se rompe (registro ≠ seguridad)', async () => {
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.userSession.create.mockRejectedValue(new Error('BD caída'))
    const token = await jwt({ token: {}, user: { email: 'a@b.com' } })
    expect(token).toMatchObject({ uuid: 'u-1' })
    expect((token as { sessionUuid?: string }).sessionUuid).toBeUndefined()
    silencio.mockRestore()
  })

  it('usuario deshabilitado o eliminado → sesión muerta al instante', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USUARIO, status: 'DISABLED' })
    expect(await jwt({ token: { email: 'a@b.com', sessionUuid: 's-1' } })).toBeNull()
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await jwt({ token: { email: 'a@b.com', sessionUuid: 's-1' } })).toBeNull()
  })

  it('sesión borrada remotamente → token nulo en la siguiente petición', async () => {
    prismaMock.userSession.findUnique.mockResolvedValue(null)
    expect(await jwt({ token: { email: 'a@b.com', sessionUuid: 's-cerrada' } })).toBeNull()
  })

  it('un JWT antiguo sin registro de sesión se invalida (relogin único)', async () => {
    expect(await jwt({ token: { email: 'a@b.com' } })).toBeNull()
  })

  it('actualiza last_seen solo si han pasado más de 5 minutos (freno de escritura)', async () => {
    prismaMock.userSession.findUnique.mockResolvedValue({ uuid: 's-1', lastSeen: new Date(Date.now() - 60_000) })
    await jwt({ token: { email: 'a@b.com', sessionUuid: 's-1' } })
    expect(prismaMock.userSession.update).not.toHaveBeenCalled()

    prismaMock.userSession.findUnique.mockResolvedValue({ uuid: 's-1', lastSeen: new Date(Date.now() - 6 * 60_000) })
    const token = await jwt({ token: { email: 'a@b.com', sessionUuid: 's-1' } })
    expect(prismaMock.userSession.update).toHaveBeenCalledWith({
      where: { uuid: 's-1' },
      data: { lastSeen: expect.any(Date) },
    })
    expect(token).toMatchObject({ uuid: 'u-1', role: 'ADMIN' })
  })

  it('los cambios de rol aplican en vivo (el token refleja la BD, no su pasado)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USUARIO, role: 'USER' })
    prismaMock.userSession.findUnique.mockResolvedValue({ uuid: 's-1', lastSeen: new Date() })
    const token = await jwt({ token: { email: 'a@b.com', role: 'ADMIN', sessionUuid: 's-1' } })
    expect(token).toMatchObject({ role: 'USER' })
  })
})

describe('callback session y evento signOut', () => {
  it('expone uuid, rol y sessionUuid en la sesión del cliente', async () => {
    const s = await session({
      session: { user: {} },
      token: { uuid: 'u-1', role: 'ADMIN', sessionUuid: 's-1' },
    })
    expect(s).toMatchObject({ sessionUuid: 's-1', user: { uuid: 'u-1', role: 'ADMIN' } })
  })

  it('el logout retira su propia fila de sesión', async () => {
    await authConfig.events!.signOut!({ token: { sessionUuid: 's-1' } } as never)
    expect(prismaMock.userSession.deleteMany).toHaveBeenCalledWith({ where: { uuid: 's-1' } })
  })

  it('un logout sin registro no toca la BD', async () => {
    await authConfig.events!.signOut!({ token: {} } as never)
    expect(prismaMock.userSession.deleteMany).not.toHaveBeenCalled()
  })
})
