// API v1 (Atajos de iOS): la autenticación por token, el parseo del cuerpo y
// las reglas compartidas del alta.
//
// Es la superficie NUEVA que se puede tocar sin sesión de Google, así que lo
// que se prueba aquí es sobre todo lo que tiene que RECHAZAR: sin token, con
// token de una cuenta deshabilitada, con un uuid de categoría inventado o con
// una categoría del tipo contrario.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    apiToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(() => ({ catch: () => {} })),
    },
    user: { findUnique: vi.fn() },
    expenseCategory: { findUnique: vi.fn(), findMany: vi.fn() },
    expense: { create: vi.fn() },
    note: { create: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
// El caso de la BD caída registra el error: no interesa verlo en la salida.
vi.mock('@/lib/log', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const TOKEN = 'ao_' + 'a'.repeat(43)
const HASH = createHash('sha256').update(TOKEN).digest('hex')

const filaToken = { uuid: 't-1', userUuid: 'u-1', tokenHash: HASH }
const admin = { status: 'ACTIVE', role: 'ADMIN' }

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.apiToken.update.mockReturnValue({ catch: () => {} })
})

describe('identificar (Bearer)', () => {
  it('acepta un token válido de un admin activo', async () => {
    const { identificar } = await import('@/lib/api-token')
    prismaMock.apiToken.findUnique.mockResolvedValue(filaToken)
    prismaMock.user.findUnique.mockResolvedValue(admin)

    expect(await identificar(`Bearer ${TOKEN}`)).toEqual({
      estado: 'ok',
      identidad: { userUuid: 'u-1', tokenUuid: 't-1' },
    })
  })

  it('rechaza sin cabecera, con otro esquema o sin el prefijo del proyecto', async () => {
    const { identificar } = await import('@/lib/api-token')
    expect(await identificar(null)).toEqual({ estado: 'invalido' })
    expect(await identificar(`Basic ${TOKEN}`)).toEqual({ estado: 'invalido' })
    expect(await identificar('Bearer sk-otracosa')).toEqual({ estado: 'invalido' })
    // Ni siquiera se consulta la BD si la forma no cuadra.
    expect(prismaMock.apiToken.findUnique).not.toHaveBeenCalled()
  })

  it('rechaza un token que no está en la tabla', async () => {
    const { identificar } = await import('@/lib/api-token')
    prismaMock.apiToken.findUnique.mockResolvedValue(null)
    expect(await identificar(`Bearer ${TOKEN}`)).toEqual({ estado: 'invalido' })
  })

  it('rechaza el token de una cuenta deshabilitada o sin rol admin', async () => {
    const { identificar } = await import('@/lib/api-token')
    prismaMock.apiToken.findUnique.mockResolvedValue(filaToken)

    prismaMock.user.findUnique.mockResolvedValue({ status: 'DISABLED', role: 'ADMIN' })
    expect(await identificar(`Bearer ${TOKEN}`)).toEqual({ estado: 'invalido' })

    prismaMock.user.findUnique.mockResolvedValue({ status: 'ACTIVE', role: 'USER' })
    expect(await identificar(`Bearer ${TOKEN}`)).toEqual({ estado: 'invalido' })

    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await identificar(`Bearer ${TOKEN}`)).toEqual({ estado: 'invalido' })
  })

  it('con la BD caída dice "indisponible", no "token inválido"', async () => {
    // La diferencia importa: un 401 le diría a su dueño que revoque el token y
    // cree otro, y el nuevo tampoco funcionaría. Lo encontró el e2e (500).
    const { identificar } = await import('@/lib/api-token')
    prismaMock.apiToken.findUnique.mockRejectedValue(new Error('ECONNREFUSED'))
    expect(await identificar(`Bearer ${TOKEN}`)).toEqual({ estado: 'indisponible' })
  })

  it('guarda solo el hash: el token en claro no aparece en la fila creada', async () => {
    const { crearToken } = await import('@/lib/api-token')
    prismaMock.apiToken.create.mockImplementation(async ({ data }: { data: Record<string, string> }) => ({
      uuid: 't-9', ...data,
    }))

    const creado = await crearToken('u-1', 'Atajos del iPhone')
    const escrito = prismaMock.apiToken.create.mock.calls[0][0].data

    expect(creado.token.startsWith('ao_')).toBe(true)
    expect(escrito.tokenHash).toBe(createHash('sha256').update(creado.token).digest('hex'))
    expect(JSON.stringify(escrito)).not.toContain(creado.token)
    // El prefijo sirve para reconocerlo, no para usarlo.
    expect(escrito.prefix.length).toBeLessThan(creado.token.length)
  })
})

describe('conversión de campos del cuerpo', () => {
  it('lee un importe con coma decimal (lo que mandan los Atajos)', async () => {
    const { aNumero } = await import('@/app/api/v1/_comun')
    expect(aNumero('12,50')).toBe(12.5)
    expect(aNumero(' 8,05 ')).toBe(8.05)
    expect(aNumero('12.50')).toBe(12.5)
    expect(aNumero(3)).toBe(3)
  })

  it('rechaza lo que no es un número', async () => {
    const { aNumero } = await import('@/app/api/v1/_comun')
    expect(aNumero('doce euros')).toBeNull()
    expect(aNumero(undefined)).toBeNull()
    expect(aNumero(Infinity)).toBeNull()
    expect(aNumero({})).toBeNull()
  })
})

describe('leerJson', () => {
  const pedir = (cuerpo: string) => new Request('http://x/api/v1/movimientos', {
    method: 'POST',
    body: cuerpo,
  })

  it('no se fía del Content-Type: parsea el cuerpo igual', async () => {
    const { leerJson } = await import('@/app/api/v1/_comun')
    const res = await leerJson(pedir('{"concepto":"a"}'))
    expect(res).toEqual({ datos: { concepto: 'a' } })
  })

  it('un cuerpo vacío es un objeto vacío, no un error', async () => {
    const { leerJson } = await import('@/app/api/v1/_comun')
    expect(await leerJson(pedir('   '))).toEqual({ datos: {} })
  })

  it('rechaza JSON mal formado, un array y un cuerpo enorme', async () => {
    const { leerJson } = await import('@/app/api/v1/_comun')

    const roto = await leerJson(pedir('{no json'))
    expect('respuesta' in roto && roto.respuesta.status).toBe(400)

    const array = await leerJson(pedir('[1,2,3]'))
    expect('respuesta' in array && array.respuesta.status).toBe(400)

    const grande = await leerJson(pedir('"' + 'x'.repeat(9000) + '"'))
    expect('respuesta' in grande && grande.respuesta.status).toBe(413)
  })
})

describe('altaMovimiento (reglas compartidas con el dashboard)', () => {
  const crear = (extra: Record<string, unknown> = {}) => ({
    type: 'GASTO',
    concept: 'Mercadona',
    amount: 12.5,
    expenseDate: '2026-09-02',
    ...extra,
  })

  beforeEach(() => {
    prismaMock.expense.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      uuid: 'm-1',
      ...data,
      expenseDate: data.expenseDate,
    }))
  })

  it('da de alta un movimiento sin categoría', async () => {
    const { altaMovimiento } = await import('@/lib/alta-movimiento')
    const res = await altaMovimiento(crear())
    expect(res.error).toBeUndefined()
    expect(prismaMock.expenseCategory.findUnique).not.toHaveBeenCalled()
  })

  it('rechaza una categoría que no existe (el FK es SET NULL: se guardaría muda)', async () => {
    const { altaMovimiento } = await import('@/lib/alta-movimiento')
    prismaMock.expenseCategory.findUnique.mockResolvedValue(null)
    const res = await altaMovimiento(crear({ categoryUuid: 'inventado' }))
    expect(res.error).toBe('Esa categoría no existe')
    expect(prismaMock.expense.create).not.toHaveBeenCalled()
  })

  it('rechaza una categoría de ingreso en un gasto', async () => {
    const { altaMovimiento } = await import('@/lib/alta-movimiento')
    prismaMock.expenseCategory.findUnique.mockResolvedValue({ uuid: 'c-1', type: 'INGRESO' })
    const res = await altaMovimiento(crear({ categoryUuid: 'c-1' }))
    expect(res.error).toBe('La categoría no es de ese tipo')
  })

  it('exige concepto, importe válido, tipo y fecha', async () => {
    const { altaMovimiento } = await import('@/lib/alta-movimiento')
    expect((await altaMovimiento(crear({ concept: '  ' }))).error).toBeTruthy()
    expect((await altaMovimiento(crear({ amount: -1 }))).error).toBeTruthy()
    expect((await altaMovimiento(crear({ type: 'REGALO' }))).error).toBeTruthy()
    expect((await altaMovimiento(crear({ expenseDate: '02/09/2026' }))).error).toBeTruthy()
  })

  it('redondea a céntimos y recorta el concepto', async () => {
    const { altaMovimiento } = await import('@/lib/alta-movimiento')
    await altaMovimiento(crear({ amount: 10.005, concept: 'x'.repeat(300) }))
    const escrito = prismaMock.expense.create.mock.calls[0][0].data
    expect(escrito.amount).toBe(10.01)
    expect((escrito.concept as string).length).toBe(255)
  })

  it('una nota vacía se guarda como null, no como cadena vacía', async () => {
    const { limpiarNotaMovimiento } = await import('@/lib/alta-movimiento')
    expect(limpiarNotaMovimiento('   ')).toBeNull()
    expect(limpiarNotaMovimiento(undefined)).toBeNull()
    expect(limpiarNotaMovimiento(' regalo de X ')).toBe('regalo de X')
  })
})

describe('resolverCategoria (por nombre, para los Atajos)', () => {
  const CATS = [
    { uuid: 'c-cafe', name: 'Café' },
    { uuid: 'c-compra', name: 'Compra' },
  ]

  it('encuentra por nombre sin tildes ni mayúsculas', async () => {
    const { resolverCategoria } = await import('@/app/api/v1/categorias/resolver')
    prismaMock.expenseCategory.findMany.mockResolvedValue(CATS)
    expect(await resolverCategoria('cafe', 'GASTO')).toEqual({ uuid: 'c-cafe', nombre: 'Café' })
    expect(await resolverCategoria('COMPRA', 'GASTO')).toEqual({ uuid: 'c-compra', nombre: 'Compra' })
  })

  it('sigue aceptando el uuid', async () => {
    const { resolverCategoria } = await import('@/app/api/v1/categorias/resolver')
    prismaMock.expenseCategory.findMany.mockResolvedValue(CATS)
    expect(await resolverCategoria('c-compra', 'GASTO')).toEqual({
      uuid: 'c-compra', nombre: 'Compra',
    })
  })

  it('sin categoría devuelve null, que es legítimo', async () => {
    const { resolverCategoria } = await import('@/app/api/v1/categorias/resolver')
    expect(await resolverCategoria(undefined, 'GASTO')).toEqual({ uuid: null, nombre: null })
    expect(await resolverCategoria('  ', 'GASTO')).toEqual({ uuid: null, nombre: null })
    expect(prismaMock.expenseCategory.findMany).not.toHaveBeenCalled()
  })

  it('avisa si el nombre no existe en ese tipo, en vez de guardarlo sin categoría', async () => {
    const { resolverCategoria } = await import('@/app/api/v1/categorias/resolver')
    prismaMock.expenseCategory.findMany.mockResolvedValue(CATS)
    const res = await resolverCategoria('Nómina', 'GASTO')
    expect('error' in res && res.error).toContain('Nómina')
  })
})

describe('altaNota (texto plano de un Atajo)', () => {
  it('convierte líneas en párrafos y escapa el HTML dictado', async () => {
    const { textoAHtml } = await import('@/lib/alta-nota')
    expect(textoAHtml('Uno\nDos')).toBe('<p>Uno</p><p>Dos</p>')
    expect(textoAHtml('  \n\nsolo una  ')).toBe('<p>solo una</p>')
    expect(textoAHtml('<script>mal()</script>')).toBe(
      '<p>&lt;script&gt;mal()&lt;/script&gt;</p>',
    )
  })

  it('el HTML que llegue por la API pasa por el MISMO saneador', async () => {
    const { altaNota } = await import('@/lib/alta-nota')
    prismaMock.note.create.mockImplementation(async ({ data }: { data: Record<string, string> }) => ({
      uuid: 'n-1', ...data,
    }))

    await altaNota({ content: '<p onclick="robar()">Hola</p><script>mal()</script>' })
    const escrito = prismaMock.note.create.mock.calls[0][0].data

    expect(escrito.content).not.toContain('onclick')
    expect(escrito.content).not.toContain('<script')
    expect(escrito.content).toContain('Hola')
  })

  it('una nota sin texto se rechaza (aunque traiga etiquetas)', async () => {
    const { altaNota } = await import('@/lib/alta-nota')
    const res = await altaNota({ content: '<div><br></div>' })
    expect(res.error).toBeTruthy()
  })
})
