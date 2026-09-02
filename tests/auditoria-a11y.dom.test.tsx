// @vitest-environment jsdom
// Auditoría de accesibilidad de las piezas del DASHBOARD.
//
// Por qué aquí y no con Playwright: el dashboard vive detrás de la sesión de
// Google, así que un axe por navegador solo alcanzaría la landing y el login
// —que ya se auditan aparte—. Aquí se montan los componentes de verdad, con
// datos representativos, y se le pasa axe al DOM que producen: eso cubre lo
// estructural (roles, nombres accesibles, etiquetas, orden de encabezados,
// ARIA válido), que es el grueso.
//
// ⚠ Lo que esto NO puede ver, y se comprueba en el navegador:
//   · `color-contrast` — jsdom no calcula estilos. Los 13 pares de tokens del
//     tema se midieron a mano: el peor sale a 6,03:1, sobre el 4,5 de AA.
//   · Tamaño de los objetivos táctiles — hace falta layout real.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import axe from 'axe-core'
import {
  CabeceraMovil,
  Celda,
  Fila,
  FilaMovil,
  FilaVacia,
  Tabla,
  TarjetaTabla,
  type Columna,
} from '@/components/ui/tabla'
import { AccesosList, type AccesoRow } from '@/components/dashboard/users/accesos-list'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/app/panel',
  useSearchParams: () => new URLSearchParams(),
}))

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(cleanup)

/** Pasa axe y devuelve las violaciones en un formato legible. */
async function auditar(nodo: Element) {
  const res = await axe.run(nodo, {
    rules: {
      // Sin layout no es evaluable (ver la cabecera).
      'color-contrast': { enabled: false },
      // Regla de PÁGINA: aquí se audita un fragmento, que por definición no
      // tiene `main` ni `nav` — los pone el layout del dashboard.
      region: { enabled: false },
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
      'html-has-lang': { enabled: false },
    },
  })
  return res.violations.map((v) => ({
    regla: v.id,
    impacto: v.impact,
    donde: v.nodes[0]?.target?.join(' '),
  }))
}

const COLS: Columna[] = [
  { label: 'Fecha' },
  { label: 'Concepto' },
  { label: 'Importe', alineado: 'derecha' },
  { label: 'Acciones', alineado: 'derecha', oculta: true },
]

describe('auditoría: tabla común', () => {
  it('la tabla con datos no tiene violaciones', async () => {
    const { baseElement } = render(
      <TarjetaTabla titulo="Movimientos de Septiembre" cuenta={2}>
        <Tabla columnas={COLS} minAncho="min-w-140">
          <Fila>
            <Celda>02/09</Celda>
            <Celda>Supermercado</Celda>
            <Celda alineado="derecha">−12,50 €</Celda>
            <Celda alineado="derecha">
              <button type="button" aria-label="Editar Supermercado">
                ✎
              </button>
            </Celda>
          </Fila>
          <Fila destacada>
            <Celda>01/09</Celda>
            <Celda>Nómina</Celda>
            <Celda alineado="derecha">+1.800,00 €</Celda>
            <Celda alineado="derecha" />
          </Fila>
        </Tabla>
      </TarjetaTabla>,
    )
    expect(await auditar(baseElement)).toEqual([])
  })

  it('la tabla vacía tampoco (la fila de aviso ocupa todas las columnas)', async () => {
    const { baseElement } = render(
      <TarjetaTabla titulo="Tokens de la API" cuenta={0}>
        <Tabla columnas={COLS}>
          <FilaVacia columnas={COLS.length}>No hay tokens creados</FilaVacia>
        </Tabla>
      </TarjetaTabla>,
    )
    expect(await auditar(baseElement)).toEqual([])
  })

  it('las cabeceras son `th` con `scope`, que es lo que las asocia a su columna', async () => {
    const { container } = render(
      <Tabla columnas={COLS}>
        <Fila>
          <Celda>x</Celda>
        </Fila>
      </Tabla>,
    )
    const ths = [...container.querySelectorAll('th')]
    expect(ths).toHaveLength(COLS.length)
    for (const th of ths) expect(th.getAttribute('scope')).toBe('col')
  })
})

describe('auditoría: rejilla móvil', () => {
  it('no tiene violaciones', async () => {
    const PLANT = 'grid-cols-[2.6rem_minmax(0,1fr)_auto_2.25rem]'
    const { baseElement } = render(
      <TarjetaTabla titulo="Movimientos de Septiembre">
        <CabeceraMovil columnas={COLS} plantilla={PLANT} />
        <FilaMovil plantilla={PLANT}>
          <span>02/09</span>
          <span>Supermercado</span>
          <span>−12,50 €</span>
          <button type="button" aria-label="Acciones de Supermercado">
            ⋯
          </button>
        </FilaMovil>
      </TarjetaTabla>,
    )
    expect(await auditar(baseElement)).toEqual([])
  })

  it('la cabecera de la rejilla NO se anuncia como si fuera una tabla', async () => {
    // Es una rejilla visual, no una tabla semántica: anunciar sus "cabeceras"
    // sería mentirle al lector de pantalla, que ya lee cada fila completa.
    const { container } = render(
      <CabeceraMovil columnas={COLS} plantilla="grid-cols-4" />,
    )
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('auditoría: histórico de accesos', () => {
  const filas: AccesoRow[] = [
    {
      uuid: 'a1',
      userName: 'Adrián Osuna',
      userEmail: 'adrian@ejemplo.com',
      userPicture: null,
      dispositivo: 'Chrome · Windows',
      ts: '2026-09-02T10:00:00.000Z',
    },
  ]

  it('con filas no tiene violaciones', async () => {
    const { baseElement } = render(<AccesosList rows={filas} total={12} />)
    expect(await auditar(baseElement)).toEqual([])
  })

  it('vacío tampoco', async () => {
    const { baseElement } = render(<AccesosList rows={[]} total={0} />)
    expect(await auditar(baseElement)).toEqual([])
  })

  it('la foto de perfil va con alt vacío: es decorativa', async () => {
    // El nombre ya está en la celda de al lado; repetirlo en el alt hace que el
    // lector lo lea dos veces.
    const { container } = render(
      <AccesosList
        rows={[{ ...filas[0], userPicture: 'https://lh3.googleusercontent.com/foto' }]}
        total={1}
      />,
    )
    const img = container.querySelector('img')
    expect(img?.getAttribute('alt')).toBe('')
  })
})
