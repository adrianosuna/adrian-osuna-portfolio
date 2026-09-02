// Sistema de mantenimiento: el encadenado de vencimientos al completar (con
// recorte a fin de mes), la clasificación vencida/próxima/al día, los textos en
// lenguaje natural de la lista (periodicidad y relativos) y los ÁMBITOS, que
// son una tabla editable: su alta/renombrado/borrado y la validación de que la
// tarea apunta a uno que existe.
import { beforeEach, describe, expect, it, vi } from 'vitest'
// El tope de peticiones vive en memoria y es COMPARTIDO por todo el proceso:
// sin reiniciarlo, un fichero de tests con muchas actions agotaría la ventana
// y los siguientes fallarían por algo que no están probando.
import { reiniciarLimites } from '@/lib/rate-limit'
import { sumarMeses } from '@/lib/fechas'

// mantenimiento.ts arrastra Prisma y el correo; aquí solo se prueban las puras
// (y las actions, con la BD simulada).
const { requireAdminMock, prismaMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  prismaMock: {
    maintenanceTask: {
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), count: vi.fn(),
    },
    maintenanceScope: {
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/auth', () => ({ requireAdmin: requireAdminMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/correo', () => ({ correoConfigurado: () => false, enviarCorreo: vi.fn() }))
vi.mock('@/lib/site', () => ({ SITE_URL: 'https://adrianosuna.com' }))
vi.mock('@/lib/ga', () => ({ visitantesAhora: vi.fn() }))
vi.mock('@/lib/infra', () => ({ snapshotServidor: vi.fn() }))

const { estadoDe } = await import('@/lib/mantenimiento')

describe('sumarMeses', () => {
  it('suma meses simples y cruza de año', () => {
    expect(sumarMeses('2026-08-25', 1)).toBe('2026-09-25')
    expect(sumarMeses('2026-08-25', 6)).toBe('2027-02-25')
    expect(sumarMeses('2026-12-15', 1)).toBe('2027-01-15')
    expect(sumarMeses('2026-08-25', 12)).toBe('2027-08-25')
  })

  it('recorta a fin de mes: 31 de enero + 1 mes = último día de febrero', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(sumarMeses('2028-01-31', 1)).toBe('2028-02-29') // bisiesto
    expect(sumarMeses('2026-05-31', 1)).toBe('2026-06-30')
  })

  it('el recorte no se hereda: 31 de enero + 2 meses = 31 de marzo', () => {
    expect(sumarMeses('2026-01-31', 2)).toBe('2026-03-31')
  })
})

describe('estadoDe', () => {
  const hoy = '2026-08-25'
  it('vencida si el vencimiento es hoy o anterior', () => {
    expect(estadoDe('2026-08-25', hoy)).toBe('vencida')
    expect(estadoDe('2026-08-01', hoy)).toBe('vencida')
  })

  it('próxima dentro de los 7 días siguientes; al día más allá', () => {
    expect(estadoDe('2026-08-26', hoy)).toBe('proxima')
    expect(estadoDe('2026-09-01', hoy)).toBe('proxima') // justo 7 días
    expect(estadoDe('2026-09-02', hoy)).toBe('aldia')
  })
})

// ─────────── Textos de la lista (lenguaje natural, sin fechas que restar) ───

const { periodicidad, cuando, antiguedad } = await import('@/components/dashboard/panel/mantenimiento')

describe('periodicidad', () => {
  it('los intervalos habituales se dicen en una palabra', () => {
    expect(periodicidad(1)).toBe('Mensual')
    expect(periodicidad(3)).toBe('Trimestral')
    expect(periodicidad(6)).toBe('Semestral')
    expect(periodicidad(12)).toBe('Anual')
  })

  it('los raros caen a "cada N meses" (o años si son exactos)', () => {
    expect(periodicidad(5)).toBe('Cada 5 meses')
    expect(periodicidad(36)).toBe('Cada 3 años')
  })
})

describe('cuando', () => {
  const hoy = '2026-08-26'

  it('hoy, mañana y ayer se dicen con palabras', () => {
    expect(cuando('2026-08-26', hoy)).toBe('Vence hoy')
    expect(cuando('2026-08-27', hoy)).toBe('Mañana')
    expect(cuando('2026-08-25', hoy)).toBe('Venció ayer')
  })

  it('el retraso se cuenta en días y, a partir del mes, en meses', () => {
    expect(cuando('2026-08-20', hoy)).toBe('Hace 6 días')
    expect(cuando('2026-07-27', hoy)).toBe('Hace un mes')
    expect(cuando('2026-05-26', hoy)).toBe('Hace 3 meses')
  })

  it('lo que falta: días hasta dos meses, después en meses o años', () => {
    expect(cuando('2026-09-25', hoy)).toBe('En 30 días')
    expect(cuando('2026-12-26', hoy)).toBe('En 4 meses')
    expect(cuando('2027-08-26', hoy)).toBe('En 1 año')
  })
})

describe('antiguedad', () => {
  const hoy = '2026-08-26'
  it('describe cuándo se hizo por última vez', () => {
    expect(antiguedad('2026-08-26', hoy)).toBe('hecha hoy')
    expect(antiguedad('2026-08-25', hoy)).toBe('hecha ayer')
    expect(antiguedad('2026-08-20', hoy)).toBe('hecha hace 6 días')
    expect(antiguedad('2026-07-27', hoy)).toBe('hecha hace un mes')
    expect(antiguedad('2025-08-26', hoy)).toBe('hecha hace un año')
  })
})


// ─────────── Ámbitos: ahora son filas, no un enum ───────────

describe('createAmbito y updateAmbito', () => {
  beforeEach(() => {
  reiniciarLimites()
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue({ user: { uuid: 'admin-1', role: 'ADMIN' } })
    prismaMock.maintenanceScope.findFirst.mockResolvedValue(null)
  })

  it('crea el ámbito con el nombre recortado', async () => {
    const { createAmbito } = await import('@/app/app/panel/actions')
    expect(await createAmbito({ name: '  Moto  ' })).toEqual({ ok: true })
    expect(prismaMock.maintenanceScope.create).toHaveBeenCalledWith({ data: { name: 'Moto' } })
  })

  it('exige nombre y no admite repetidos', async () => {
    const { createAmbito } = await import('@/app/app/panel/actions')
    expect(await createAmbito({ name: '   ' })).toEqual({
      ok: false, message: 'El nombre es obligatorio',
    })
    prismaMock.maintenanceScope.findFirst.mockResolvedValue({ uuid: 'otro' })
    expect(await createAmbito({ name: 'Casa' })).toEqual({
      ok: false, message: 'Ya existe un ámbito con ese nombre',
    })
    expect(prismaMock.maintenanceScope.create).not.toHaveBeenCalled()
  })

  it('renombrar a un nombre que ya usa OTRO se rechaza (el propio vale)', async () => {
    const { updateAmbito } = await import('@/app/app/panel/actions')
    prismaMock.maintenanceScope.findFirst.mockResolvedValue({ uuid: 'otro' })
    expect(await updateAmbito('a1', { name: 'Casa' })).toEqual({
      ok: false, message: 'Ya existe un ámbito con ese nombre',
    })
    prismaMock.maintenanceScope.findFirst.mockResolvedValue({ uuid: 'a1' })
    expect(await updateAmbito('a1', { name: 'Casa' })).toEqual({ ok: true })
  })
})

describe('deleteAmbito', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue({ user: { uuid: 'admin-1', role: 'ADMIN' } })
  })

  it('no se puede borrar uno en uso', async () => {
    prismaMock.maintenanceTask.count.mockResolvedValue(5)
    const { deleteAmbito } = await import('@/app/app/panel/actions')
    expect(await deleteAmbito('a1')).toEqual({
      ok: false,
      message: 'No se puede borrar: lo usan 5 tareas. Cámbialas de ámbito primero.',
    })
    expect(prismaMock.maintenanceScope.delete).not.toHaveBeenCalled()
  })

  it('uno sin tareas sí se borra', async () => {
    prismaMock.maintenanceTask.count.mockResolvedValue(0)
    const { deleteAmbito } = await import('@/app/app/panel/actions')
    expect(await deleteAmbito('a1')).toEqual({ ok: true })
    expect(prismaMock.maintenanceScope.delete).toHaveBeenCalledWith({ where: { uuid: 'a1' } })
  })
})

describe('createMaintenance y updateMaintenance', () => {
  const base = { title: 'ITV', intervalMonths: 12, nextDue: '2027-03-20', scopeUuid: 'a-vehiculo' }

  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue({ user: { uuid: 'admin-1', role: 'ADMIN' } })
    // Por defecto, el ámbito que se pasa existe.
    prismaMock.maintenanceScope.findUnique.mockResolvedValue({ uuid: 'a-vehiculo', name: 'Vehículo' })
  })

  it('guarda la tarea con su ámbito', async () => {
    const { createMaintenance } = await import('@/app/app/panel/actions')
    expect(await createMaintenance(base)).toEqual({ ok: true })
    const data = prismaMock.maintenanceTask.create.mock.calls[0][0].data
    expect(data).toMatchObject({ title: 'ITV', scopeUuid: 'a-vehiculo', intervalMonths: 12, notes: null })
    expect((data.nextDue as Date).toISOString()).toBe('2027-03-20T00:00:00.000Z')
  })

  it('sin ámbito, o con uno que no existe, no se guarda', async () => {
    const { createMaintenance } = await import('@/app/app/panel/actions')
    expect(await createMaintenance({ ...base, scopeUuid: '' })).toEqual({
      ok: false, message: 'Elige un ámbito',
    })
    prismaMock.maintenanceScope.findUnique.mockResolvedValue(null)
    expect(await createMaintenance({ ...base, scopeUuid: 'fantasma' })).toEqual({
      ok: false, message: 'Ese ámbito no existe',
    })
    expect(prismaMock.maintenanceTask.create).not.toHaveBeenCalled()
  })

  it('sigue exigiendo título, periodicidad de 1 a 120 meses y fecha válida', async () => {
    const { createMaintenance } = await import('@/app/app/panel/actions')
    expect(await createMaintenance({ ...base, title: '  ' })).toEqual({
      ok: false, message: 'El título es obligatorio',
    })
    expect(await createMaintenance({ ...base, intervalMonths: 0 })).toEqual({
      ok: false, message: 'La periodicidad debe ser de 1 a 120 meses',
    })
    expect(await createMaintenance({ ...base, nextDue: '20/03/2027' })).toEqual({
      ok: false, message: 'La fecha de vencimiento no es válida',
    })
    expect(prismaMock.maintenanceTask.create).not.toHaveBeenCalled()
  })

  it('al editar, cambiar de ámbito también reinicia el aviso', async () => {
    const { updateMaintenance } = await import('@/app/app/panel/actions')
    expect(await updateMaintenance('t1', { ...base, scopeUuid: 'a-casa' })).toEqual({ ok: true })
    const data = prismaMock.maintenanceTask.update.mock.calls[0][0].data
    expect(data.scopeUuid).toBe('a-casa')
    expect(data.lastNotified).toBeNull()
  })
})
