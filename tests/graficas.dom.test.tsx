// @vitest-environment jsdom
// Las gráficas ahora son Chart.js sobre <canvas>, y jsdom no tiene contexto 2D:
// no se puede medir el dibujo. Lo que sí se puede —y es lo que importa— es
// comprobar el CONTRATO que cada gráfica le pasa a Chart.js: series, colores
// del tema, unidad del tooltip, apilado y los callbacks de los ejes.
//
// Antes estos tests medían el `viewBox` del SVG a mano; con canvas no existe.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

interface ConfigCapturada {
  type: string
  data: { labels: string[]; datasets: Array<Record<string, unknown>> }
  options: {
    onClick?: (
      e: unknown,
      els: Array<{ index: number; datasetIndex: number }>,
      chart: unknown,
    ) => void
    scales?: Record<string, { ticks?: { callback?: (v: number) => string } }>
    plugins?: { tooltip?: { callbacks?: { title?: (items: Array<{ dataIndex: number }>) => string } } }
  }
}

const configs: ConfigCapturada[] = []

vi.mock('@/components/ui/charts/comun', () => ({
  Chart: class ChartFalso {
    constructor(_canvas: unknown, config: ConfigCapturada) {
      configs.push(config)
    }
    destroy() {}
    static getChart() {
      return null
    }
  },
  coloresTema: () => ({
    primary: '#10b981',
    success: '#22c55e',
    danger: '#ef4444',
    warning: '#f59e0b',
    viajes: '#38bdf8',
    texto: '#e6f2ec',
    suave: '#94a3b8',
    borde: '#1e3a32',
    fondo: '#0f1d18',
  }),
  tooltipPlugin: { enabled: false },
  token: () => '#10b981',
  // El mock devuelve el color tal cual: los tests comprueban qué color PIDE
  // cada gráfica, no la resolución de var() (eso lo cubre resolver-color.test).
  resolverColor: (c: string) => c,
  eur: (v: number) => `${v} €`,
}))

// gastos.tsx importa sus server actions (→ prisma → auth): se mockean.
vi.mock('@/app/app/finance/gastos-actions', () => ({
  createGasto: vi.fn(),
  updateGasto: vi.fn(),
  deleteGasto: vi.fn(),
  createCategoria: vi.fn(),
  updateCategoria: vi.fn(),
  deleteCategoria: vi.fn(),
}))

const { MovimientosPorMes } = await import('@/components/dashboard/savings/gastos')
const { AhorroPorMes, AhorroAcumulado } = await import('@/components/dashboard/savings/charts')
const { GraficaDonut } = await import('@/components/ui/charts/donut')
const { filaTooltip, marcoTooltip } = await import('@/components/ui/charts/tooltip')

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  configs.length = 0
})
afterEach(cleanup)

const MESES_GASTOS = Array.from({ length: 12 }, (_, i) => ({
  mes: i + 1,
  ingresos: 1850,
  gastos: 1200 + i * 10,
}))

describe('MovimientosPorMes (ingresos y gastos por mes)', () => {
  it('pasa doce meses y dos series con los colores del tema', () => {
    render(<MovimientosPorMes meses={MESES_GASTOS} />)
    const [cfg] = configs
    expect(cfg.type).toBe('bar')
    expect(cfg.data.labels).toHaveLength(12)
    expect(cfg.data.labels[0]).toBe('Ene')
    expect(cfg.data.datasets.map((d) => d.label)).toEqual(['Ingresos', 'Gastos'])
    expect(cfg.data.datasets[0].backgroundColor).toBe('#22c55e') // success
    expect(cfg.data.datasets[1].backgroundColor).toBe('#ef4444') // danger
    // El tooltip debe formatear en euros, no como número suelto.
    expect(cfg.data.datasets.every((d) => d._unidad === 'eur')).toBe(true)
  })

  it('clic en la barra de un mes lo abre (índice 0-11 → mes 1-12)', () => {
    const onMes = vi.fn()
    render(<MovimientosPorMes meses={MESES_GASTOS} onMes={onMes} />)
    const [cfg] = configs
    // Marzo es el índice 2 del eje y el mes 3 en la URL.
    cfg.options.onClick?.({}, [{ index: 2, datasetIndex: 0 }], {})
    expect(onMes).toHaveBeenCalledWith(3)
    cfg.options.onClick?.({}, [{ index: 11, datasetIndex: 1 }], {})
    expect(onMes).toHaveBeenCalledWith(12)
  })

  it('sin onMes no se registra clic (la gráfica no es pulsable)', () => {
    render(<MovimientosPorMes meses={MESES_GASTOS} />)
    const [cfg] = configs
    // El handler existe siempre (lo pone el componente base), pero no debe
    // hacer nada si no se le pasó a dónde ir.
    expect(() => cfg.options.onClick?.({}, [{ index: 0, datasetIndex: 0 }], {})).not.toThrow()
  })

  it('el eje Y abrevia los miles y el tooltip titula con el mes en largo', () => {
    render(<MovimientosPorMes meses={MESES_GASTOS} />)
    const [cfg] = configs
    const eje = cfg.options.scales?.y?.ticks?.callback
    expect(eje?.(1500)).toBe('1,5k')
    expect(eje?.(800)).toBe('800')
    const titulo = cfg.options.plugins?.tooltip?.callbacks?.title
    expect(titulo?.([{ dataIndex: 7 }])).toBe('Agosto')
  })
})

describe('escape del tooltip (se inyecta con innerHTML)', () => {
  // El tooltip es el único sitio que construye HTML a mano: un nombre de
  // categoría con `<` no puede convertirse en marcado. El color NO se escapa
  // (viene del código, va en un atributo style).
  it('escapa el nombre y el valor de una fila', () => {
    const html = filaTooltip({ nombre: '<img src=x onerror=alert(1)>', valor: '3 & 4' })
    expect(html).not.toContain('<img')
    expect(html).toContain('&#60;img')
    expect(html).toContain('3 &#38; 4')
  })

  it('escapa el título del marco', () => {
    const html = marcoTooltip('<span>fila</span>', '<b>Agosto</b>')
    // El título (dato) va escapado; las filas ya vienen construidas por
    // filaTooltip y se insertan tal cual.
    expect(html).toContain('&#60;b&#62;Agosto')
    expect(html).not.toContain('<b>Agosto')
  })

  it('deja pasar el color de la fila sin tocarlo (no es texto de usuario)', () => {
    const html = filaTooltip({ color: '#ef4444', nombre: 'Gastos', valor: '12 €' })
    expect(html).toContain('background:#ef4444')
  })
})

describe('filas extra del tooltip', () => {
  it('el callback NO va dentro de options (Chart.js lo trataría como scriptable)', () => {
    render(
      <MovimientosPorMes
        meses={MESES_GASTOS}
        onMes={undefined}
      />,
    )
    const [cfg] = configs
    const tooltip = cfg.options.plugins?.tooltip as Record<string, unknown> | undefined
    // Si esto vuelve a colarse en options, Chart.js revienta con
    // "Cannot convert object to primitive value" al pintar el tooltip.
    expect(tooltip?._extra).toBeUndefined()
  })
})

describe('AhorroPorMes', () => {
  const meses = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    income: 1800,
    savingGeneral: 400,
    savingTravel: 60,
  }))

  it('apila general y viajes, cada uno con su token', () => {
    render(<AhorroPorMes months={meses} />)
    const [cfg] = configs
    expect(cfg.options.scales?.x).toBeDefined()
    expect(cfg.data.datasets.map((d) => d.label)).toEqual(['General', 'Viajes'])
    expect(cfg.data.datasets[0].backgroundColor).toBe('#10b981') // primary
    expect(cfg.data.datasets[1].backgroundColor).toBe('#38bdf8') // viajes
    expect(cfg.data.datasets[0].data).toEqual(Array(12).fill(400))
  })
})

describe('AhorroAcumulado', () => {
  it('es una línea con un punto por año', () => {
    render(<AhorroAcumulado puntos={[{ year: 2025, valor: 8805 }, { year: 2026, valor: 20009 }]} />)
    const [cfg] = configs
    expect(cfg.type).toBe('line')
    expect(cfg.data.labels).toEqual(['2025', '2026'])
    expect(cfg.data.datasets[0].data).toEqual([8805, 20009])
  })
})

describe('GraficaDonut', () => {
  const partes = [
    { label: 'Ahorro mensual', valor: 4900, color: '#10b981' },
    { label: 'Ingresos extra', valor: 3870, color: '#f59e0b' },
    { label: 'Sobrante de viajes', valor: 34, color: '#38bdf8' },
  ]

  it('sin nada que repartir muestra el texto de vacío y no crea gráfica', () => {
    render(<GraficaDonut partes={[]} vacio="Sin datos de ahorro todavía." />)
    expect(screen.getByText('Sin datos de ahorro todavía.')).toBeTruthy()
    expect(configs).toHaveLength(0)
  })

  it('pinta un arco por parte positiva, con su color', () => {
    render(<GraficaDonut partes={partes} />)
    const [cfg] = configs
    expect(cfg.type).toBe('doughnut')
    expect(cfg.data.datasets[0].data).toEqual([4900, 3870, 34])
    expect(cfg.data.datasets[0].backgroundColor).toEqual(['#10b981', '#f59e0b', '#38bdf8'])
  })

  it('la leyenda lleva importe y porcentaje por fila', () => {
    render(<GraficaDonut partes={partes} />)
    // El importe y el porcentaje van en spans distintos de la misma fila:
    // se comprueba sobre el texto de la fila completa (4.900 de 8.804 → 56 %,
    // con el espacio irrompible que pone Intl).
    const fila = screen.getByText('Ahorro mensual').parentElement
    expect(fila?.textContent).toContain('4.900')
    expect(fila?.textContent).toContain(`56${String.fromCharCode(0x00a0)}%`)
  })

  it('una parte a cero se lista en la leyenda pero no entra en el donut', () => {
    render(<GraficaDonut partes={[...partes, { label: 'Vacía', valor: 0, color: '#000' }]} />)
    const [cfg] = configs
    expect(cfg.data.datasets[0].data).toHaveLength(3)
    expect(screen.getByText('Vacía')).toBeTruthy()
  })
})
