// Validaciones y guardas de las server actions (con auth, Prisma y caché
// mockeados): saneado de entradas, autoprotecciones del admin (no puede
// revocarse, eliminarse ni cerrar su propia sesión) y contrato { ok, message? }.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/errors'

const { requireAdminMock, prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    userSession: { delete: vi.fn(), deleteMany: vi.fn() },
    savingYear: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    savingMonth: { upsert: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  }
  return { requireAdminMock: vi.fn(), prismaMock }
})

vi.mock('@/auth', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/ga', () => ({ visitantesAhora: vi.fn() }))
vi.mock('@/lib/infra', () => ({ snapshotServidor: vi.fn() }))

const SESION_ADMIN = { user: { uuid: 'admin-1', role: 'ADMIN' }, sessionUuid: 'sesion-propia' }

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue(SESION_ADMIN)
  prismaMock.user.findUnique.mockResolvedValue(null)
  prismaMock.savingYear.findUnique.mockResolvedValue(null)
})

// ─────────── Gestión de usuarios y sesiones (panel/actions) ───────────

describe('inviteUser', () => {
  it('rechaza correo vacío y correo con formato inválido', async () => {
    const { inviteUser } = await import('@/app/app/panel/actions')
    expect(await inviteUser({ email: '   ', role: 'USER' })).toEqual({ ok: false, message: 'El correo es obligatorio' })
    expect(await inviteUser({ email: 'esto-no-es-un-correo', role: 'USER' })).toEqual({ ok: false, message: 'Correo no válido' })
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('rechaza un correo ya dado de alta', async () => {
    const { inviteUser } = await import('@/app/app/panel/actions')
    prismaMock.user.findUnique.mockResolvedValue({ uuid: 'existe' })
    const res = await inviteUser({ email: 'ya@existe.com', role: 'USER' })
    expect(res).toEqual({ ok: false, message: 'Ese correo ya está dado de alta' })
  })

  it('normaliza a minúsculas, recorta espacios y crea como INVITED', async () => {
    const { inviteUser } = await import('@/app/app/panel/actions')
    const res = await inviteUser({ email: '  Nuevo@Gmail.COM ', role: 'ADMIN' })
    expect(res).toEqual({ ok: true })
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: { email: 'nuevo@gmail.com', role: 'ADMIN', status: 'INVITED' },
    })
  })

  it('roles desconocidos degradan a USER (cliente manipulado)', async () => {
    const { inviteUser } = await import('@/app/app/panel/actions')
    await inviteUser({ email: 'a@b.com', role: 'SUPERROOT' as never })
    expect(prismaMock.user.create.mock.calls[0][0].data.role).toBe('USER')
  })
})

describe('updateUser', () => {
  it('el admin no puede quitarse el rol ni deshabilitarse a sí mismo', async () => {
    const { updateUser } = await import('@/app/app/panel/actions')
    const porRol = await updateUser('admin-1', { role: 'USER' })
    const porEstado = await updateUser('admin-1', { status: 'DISABLED' })
    expect(porRol.ok).toBe(false)
    expect(porEstado.ok).toBe(false)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('sin cambios no toca la BD', async () => {
    const { updateUser } = await import('@/app/app/panel/actions')
    expect(await updateUser('otro', {})).toEqual({ ok: false, message: 'Nada que actualizar' })
  })

  it('sobre otro usuario aplica el parche', async () => {
    const { updateUser } = await import('@/app/app/panel/actions')
    expect(await updateUser('otro', { role: 'ADMIN' })).toEqual({ ok: true })
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { uuid: 'otro' }, data: { role: 'ADMIN' } })
  })
})

describe('removeUser', () => {
  it('el admin no puede eliminarse a sí mismo', async () => {
    const { removeUser } = await import('@/app/app/panel/actions')
    expect((await removeUser('admin-1')).ok).toBe(false)
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it('al eliminar a otro, limpia también sus sesiones (sin FK física)', async () => {
    const { removeUser } = await import('@/app/app/panel/actions')
    expect(await removeUser('otro')).toEqual({ ok: true })
    expect(prismaMock.userSession.deleteMany).toHaveBeenCalledWith({ where: { userUuid: 'otro' } })
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { uuid: 'otro' } })
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })
})

describe('closeSession', () => {
  it('no permite cerrar la sesión actual del propio admin', async () => {
    const { closeSession } = await import('@/app/app/panel/actions')
    const res = await closeSession('sesion-propia')
    expect(res.ok).toBe(false)
    expect(prismaMock.userSession.delete).not.toHaveBeenCalled()
  })

  it('cierra cualquier otra sesión', async () => {
    const { closeSession } = await import('@/app/app/panel/actions')
    expect(await closeSession('sesion-ajena')).toEqual({ ok: true })
    expect(prismaMock.userSession.delete).toHaveBeenCalledWith({ where: { uuid: 'sesion-ajena' } })
  })
})

describe('guarded (contrato de errores)', () => {
  it('los mensajes de AppError sí llegan al cliente', async () => {
    const { inviteUser } = await import('@/app/app/panel/actions')
    requireAdminMock.mockRejectedValue(new AppError('Solo administradores'))
    expect(await inviteUser({ email: 'a@b.com', role: 'USER' })).toEqual({ ok: false, message: 'Solo administradores' })
  })

  it('cualquier otra excepción se oculta tras "Error inesperado"', async () => {
    const { inviteUser } = await import('@/app/app/panel/actions')
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {})
    requireAdminMock.mockRejectedValue(new Error('P2002: detalle interno de Prisma'))
    expect(await inviteUser({ email: 'a@b.com', role: 'USER' })).toEqual({ ok: false, message: 'Error inesperado' })
    silencio.mockRestore()
  })
})

// ─────────── Sistema de ahorro (finance/actions) ───────────

describe('createYear', () => {
  it('rechaza años fuera de rango o duplicados', async () => {
    const { createYear } = await import('@/app/app/finance/actions')
    expect(await createYear({ year: 1999 })).toEqual({ ok: false, message: 'Indica un año válido' })
    prismaMock.savingYear.findUnique.mockResolvedValue({ uuid: 'ya-existe' })
    expect(await createYear({ year: 2026 })).toEqual({ ok: false, message: 'Ese año ya existe' })
  })

  it('crea el año solo con su objetivo; un objetivo no positivo queda en null', async () => {
    const { createYear } = await import('@/app/app/finance/actions')
    expect(await createYear({ year: 2026, goal: 9_000 })).toEqual({ ok: true })
    expect(prismaMock.savingYear.create).toHaveBeenCalledWith({
      data: { year: 2026, goal: 9_000 },
    })

    await createYear({ year: 2027, goal: -5 })
    expect(prismaMock.savingYear.create).toHaveBeenLastCalledWith({
      data: { year: 2027, goal: null },
    })
  })
})

describe('saveMonths', () => {
  it('sanea valores absurdos (NaN, Infinity, cifras imposibles) a null y filtra meses inválidos', async () => {
    const { saveMonths } = await import('@/app/app/finance/actions')
    prismaMock.savingYear.findUnique.mockResolvedValue({ uuid: 'y26' })
    const res = await saveMonths('y26', [
      { month: 1, income: 2_000, savingGeneral: Number.NaN, savingTravel: 1e12 },
      { month: 99, income: 1, savingGeneral: 1, savingTravel: 1 }, // mes inválido: fuera
    ])
    expect(res).toEqual({ ok: true })
    expect(prismaMock.savingMonth.upsert).toHaveBeenCalledTimes(1)
    const args = prismaMock.savingMonth.upsert.mock.calls[0][0]
    expect(args.create).toMatchObject({ month: 1, income: 2_000, savingGeneral: null, savingTravel: null })
  })
})
