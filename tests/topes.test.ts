// Topes de gasto por categoría: el cálculo puro del estado de cada tope y el
// aviso por correo, cuya gracia está en NO repetirse — un correo por mes y por
// nivel alcanzado, recordado en `budget_notified` como 'YYYY-MM:nivel'.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nivelTope, resumenTopes, topesDelMes, UMBRAL_LIMITE } from '@/lib/topes'

const cat = (uuid: string, budget: number | null, type: 'GASTO' | 'INGRESO' = 'GASTO') => ({
  uuid,
  name: uuid,
  color: '#10b981',
  type,
  budget,
})

const gasto = (categoryUuid: string | null, amount: number) => ({
  type: 'GASTO' as const,
  amount,
  categoryUuid,
})

describe('nivelTope', () => {
  it('marca el límite al 80 % y el pasado al 100 %', () => {
    expect(UMBRAL_LIMITE).toBe(80)
    expect(nivelTope(0)).toBe('ok')
    expect(nivelTope(79.9)).toBe('ok')
    expect(nivelTope(80)).toBe('limite')
    expect(nivelTope(99.9)).toBe('limite')
    expect(nivelTope(100)).toBe('pasado')
    expect(nivelTope(240)).toBe('pasado')
  })
})

describe('topesDelMes', () => {
  it('solo cuenta las categorías de gasto con tope positivo', () => {
    const topes = topesDelMes(
      [cat('c1', 100), cat('c2', null), cat('c3', 0), cat('i1', 500, 'INGRESO')],
      [gasto('c1', 50), gasto('c2', 999), gasto('c3', 999), gasto('i1', 999)],
    )
    expect(topes.map((t) => t.uuid)).toEqual(['c1'])
  })

  it('reparte el gasto por categoría y calcula el porcentaje sin recortarlo', () => {
    const topes = topesDelMes(
      [cat('c1', 400), cat('c2', 100)],
      [gasto('c1', 100), gasto('c1', 100), gasto('c2', 250)],
    )
    expect(topes.find((t) => t.uuid === 'c1')).toMatchObject({ gastado: 200, pct: 50 })
    // 250 de 100: el porcentaje pasa de 100 en vez de quedarse clavado ahí.
    expect(topes.find((t) => t.uuid === 'c2')).toMatchObject({ gastado: 250, pct: 250 })
  })

  it('ordena del más apurado al que más margen le queda', () => {
    const topes = topesDelMes(
      [cat('holgado', 1000), cat('pasado', 100), cat('justo', 100)],
      [gasto('holgado', 100), gasto('pasado', 180), gasto('justo', 85)],
    )
    expect(topes.map((t) => t.uuid)).toEqual(['pasado', 'justo', 'holgado'])
  })

  it('saca los topes sin gasto a cero (saber que no lo has tocado también vale)', () => {
    const topes = topesDelMes([cat('c1', 300)], [])
    expect(topes).toEqual([
      { uuid: 'c1', name: 'c1', color: '#10b981', budget: 300, gastado: 0, pct: 0 },
    ])
  })

  it('ignora los ingresos y los gastos sin categoría', () => {
    const topes = topesDelMes(
      [cat('c1', 100)],
      [gasto(null, 500), { type: 'INGRESO', amount: 900, categoryUuid: 'c1' }],
    )
    expect(topes[0]).toMatchObject({ gastado: 0, pct: 0 })
  })
})

describe('resumenTopes', () => {
  it('suma topes y gasto y cuenta cuántos están pasados o al límite', () => {
    const topes = topesDelMes(
      [cat('c1', 100), cat('c2', 100), cat('c3', 100)],
      [gasto('c1', 120), gasto('c2', 85), gasto('c3', 10)],
    )
    expect(resumenTopes(topes)).toEqual({
      total: 300,
      gastado: 215,
      restante: 85,
      pasados: 1,
      alLimite: 1,
    })
  })

  it('el restante se va en negativo cuando el conjunto se pasa', () => {
    const topes = topesDelMes([cat('c1', 100)], [gasto('c1', 175)])
    expect(resumenTopes(topes).restante).toBe(-75)
  })

  it('sin topes, todo a cero (y sin dividir por cero)', () => {
    expect(resumenTopes([])).toEqual({
      total: 0, gastado: 0, restante: 0, pasados: 0, alLimite: 0,
    })
  })
})

// ─────────── aviso por correo ───────────

const { prismaMock, correoMock } = vi.hoisted(() => ({
  prismaMock: {
    expenseCategory: { findMany: vi.fn(), updateMany: vi.fn() },
    expense: { groupBy: vi.fn() },
  },
  correoMock: {
    // La firma va en el genérico de vi.fn: sin ella `mock.calls[0]` es una
    // tupla vacía y no se puede leer el asunto ni el cuerpo.
    enviarCorreo: vi.fn<(asunto: string, cuerpo: string) => Promise<void>>(async () => {}),
    correoConfigurado: vi.fn(() => true),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/correo', () => ({
  correoConfigurado: correoMock.correoConfigurado,
  enviarCorreo: correoMock.enviarCorreo,
  tarjetaHtml: (t: string, d: string) => `<card>${t}|${d}</card>`,
  botonHtml: () => '<btn>',
}))

/** Prepara la BD simulada: categorías con tope y gasto del mes por categoría. */
const preparar = (
  categorias: Array<{ uuid: string; name: string; budget: number | null; notified: string | null }>,
  gastos: Array<{ categoryUuid: string; total: number }>,
) => {
  // Dos consultas distintas sobre expenseCategory: las categorías con tope y,
  // después, sus marcas de aviso.
  prismaMock.expenseCategory.findMany
    .mockResolvedValueOnce(categorias.map((c) => ({ ...c, color: '#10b981', type: 'GASTO' })))
    .mockResolvedValueOnce(categorias.map((c) => ({ uuid: c.uuid, notified: c.notified })))
  prismaMock.expense.groupBy.mockResolvedValue(
    gastos.map((g) => ({ categoryUuid: g.categoryUuid, _sum: { amount: g.total } })),
  )
}

/** Claves escritas en las categorías, como { uuid: 'YYYY-MM:nivel' }. */
const marcasEscritas = () => {
  const escritas: Record<string, string | null> = {}
  for (const [args] of prismaMock.expenseCategory.updateMany.mock.calls) {
    for (const uuid of args.where.uuid.in) escritas[uuid] = args.data.notified
  }
  return escritas
}

describe('avisarTopes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    correoMock.correoConfigurado.mockReturnValue(true)
    prismaMock.expenseCategory.updateMany.mockResolvedValue({ count: 1 })
  })

  it('avisa de los topes pasados y de los que están al límite, en un solo correo', async () => {
    preparar(
      [
        { uuid: 'c1', name: 'Comer fuera', budget: 100, notified: null },
        { uuid: 'c2', name: 'Supermercado', budget: 400, notified: null },
        { uuid: 'c3', name: 'Casa', budget: 900, notified: null },
      ],
      [
        { categoryUuid: 'c1', total: 140 },
        { categoryUuid: 'c2', total: 340 },
        { categoryUuid: 'c3', total: 100 },
      ],
    )
    const { avisarTopes } = await import('@/lib/gastos')
    expect(await avisarTopes('2026-08-28')).toBe(2)

    expect(correoMock.enviarCorreo).toHaveBeenCalledOnce()
    const [asunto, cuerpo] = correoMock.enviarCorreo.mock.calls[0]
    expect(asunto).toContain('Topes de Agosto')
    expect(asunto).toContain('1 pasado')
    expect(asunto).toContain('1 al límite')
    expect(cuerpo).toContain('Comer fuera')
    expect(cuerpo).toContain('Supermercado')
    // La categoría holgada no sale ni en el correo ni en las marcas.
    expect(cuerpo).not.toContain('Casa')
    expect(marcasEscritas()).toEqual({ c1: '2026-08:pasado', c2: '2026-08:limite' })
  })

  it('no repite el aviso del mismo nivel en el mismo mes', async () => {
    preparar(
      [{ uuid: 'c1', name: 'Comer fuera', budget: 100, notified: '2026-08:pasado' }],
      [{ categoryUuid: 'c1', total: 190 }],
    )
    const { avisarTopes } = await import('@/lib/gastos')
    expect(await avisarTopes('2026-08-28')).toBe(0)
    expect(correoMock.enviarCorreo).not.toHaveBeenCalled()
  })

  it('vuelve a avisar cuando el tope escala de "al límite" a "pasado"', async () => {
    preparar(
      [{ uuid: 'c1', name: 'Comer fuera', budget: 100, notified: '2026-08:limite' }],
      [{ categoryUuid: 'c1', total: 105 }],
    )
    const { avisarTopes } = await import('@/lib/gastos')
    expect(await avisarTopes('2026-08-28')).toBe(1)
    expect(marcasEscritas()).toEqual({ c1: '2026-08:pasado' })
  })

  it('el mes siguiente avisa otra vez, aunque la marca del mes anterior siga ahí', async () => {
    preparar(
      [{ uuid: 'c1', name: 'Comer fuera', budget: 100, notified: '2026-08:pasado' }],
      [{ categoryUuid: 'c1', total: 130 }],
    )
    const { avisarTopes } = await import('@/lib/gastos')
    expect(await avisarTopes('2026-09-02')).toBe(1)
    expect(marcasEscritas()).toEqual({ c1: '2026-09:pasado' })
  })

  it('un tope que vuelve a estar bien limpia su marca y no manda correo', async () => {
    preparar(
      [{ uuid: 'c1', name: 'Comer fuera', budget: 1000, notified: '2026-08:pasado' }],
      [{ categoryUuid: 'c1', total: 140 }],
    )
    const { avisarTopes } = await import('@/lib/gastos')
    expect(await avisarTopes('2026-08-28')).toBe(0)
    expect(correoMock.enviarCorreo).not.toHaveBeenCalled()
    expect(marcasEscritas()).toEqual({ c1: null })
  })

  it('sin SMTP configurado no consulta nada', async () => {
    correoMock.correoConfigurado.mockReturnValue(false)
    const { avisarTopes } = await import('@/lib/gastos')
    expect(await avisarTopes('2026-08-28')).toBe(0)
    expect(prismaMock.expenseCategory.findMany).not.toHaveBeenCalled()
  })

  it('sin ningún tope puesto no manda nada', async () => {
    preparar([], [])
    const { avisarTopes } = await import('@/lib/gastos')
    expect(await avisarTopes('2026-08-28')).toBe(0)
    expect(correoMock.enviarCorreo).not.toHaveBeenCalled()
  })
})
