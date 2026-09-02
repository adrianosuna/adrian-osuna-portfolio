// @vitest-environment jsdom
// Auditoría de accesibilidad (axe-core) de las piezas COMPARTIDAS por todo lo
// nuevo: el modal común (que usan la paleta ⌘K, el diálogo de confirmación y
// todos los formularios), los campos de `fields.tsx` y las sub-pestañas.
//
// Se auditan los cimientos y no cada pantalla a propósito: un fallo de nombre
// accesible o de rol está casi siempre en la pieza reutilizada, y probarla una
// vez cubre las veinte pantallas que la montan.
//
// Por qué en jsdom y no en un navegador: las tres cuartas partes de estas
// pantallas viven detrás de la sesión de Google, así que un axe por Playwright
// solo alcanzaría la landing — justo lo que NO es nuevo. Aquí se monta el
// componente y se le pasa axe al DOM real que produce.
//
// ⚠ `color-contrast` se DESACTIVA: jsdom no calcula estilos ni layout, así que
// esa regla no puede evaluarse (devolvería "incomplete", no un aprobado). El
// contraste de lo nuevo se midió a mano en el navegador —y ahí salió un fallo
// real, el blanco sobre `--danger` (2,77:1), que se corrigió a texto oscuro—.
// Lo que sí comprueba axe aquí es lo estructural: roles, nombres accesibles,
// etiquetas de los campos, orden de encabezados y atributos ARIA válidos.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import axe from 'axe-core'
import { Modal } from '@/components/ui/modal'
import { DateField, Field, NumberField, SelectField, TextField } from '@/components/ui/fields'
import { SubTabs } from '@/components/dashboard/sub-tabs'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/app/panel',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/dashboard/barra-carga', () => ({ useCarga: () => vi.fn() }))

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(cleanup)

/** Pasa axe por el contenedor y devuelve las violaciones legibles. */
async function auditar(nodo: Element) {
  const res = await axe.run(nodo, {
    rules: {
      // Ver la cabecera: sin layout, esta regla no es evaluable en jsdom.
      'color-contrast': { enabled: false },
      // Regla de PÁGINA ("todo el contenido dentro de un landmark"): aquí se
      // audita un fragmento suelto, que por definición no tiene main ni nav.
      // Los landmarks del dashboard los pone el layout, no estos componentes.
      region: { enabled: false },
    },
  })
  return res.violations.map((v) => ({
    regla: v.id,
    impacto: v.impact,
    // El selector del primer nodo afectado: es lo que hace falta para arreglarlo.
    donde: v.nodes[0]?.target?.join(' '),
    ayuda: v.help,
  }))
}

describe('axe: modal común', () => {
  it('el modal con cabecera, cuerpo y pie no tiene violaciones', async () => {
    const { baseElement } = render(
      <Modal title="Nuevo token" description="Un token por cada sitio" onClose={vi.fn()}
        footer={<button type="button">Crear</button>}>
        <p>Contenido</p>
      </Modal>,
    )
    expect(await auditar(baseElement)).toEqual([])
  })

  it('un modal con los campos de fields.tsx dentro tampoco', async () => {
    // Es el caso real: todos los formularios del dashboard son este.
    const { baseElement } = render(
      <Modal title="Nuevo movimiento" onClose={vi.fn()} footer={<button type="button">Guardar</button>}>
        <Field label="Concepto">
          <TextField value="" onChange={vi.fn()} />
        </Field>
        <Field label="Importe">
          <NumberField value={null} onChange={vi.fn()} />
        </Field>
        <Field label="Fecha">
          <DateField value="2026-09-02" onChange={vi.fn()} />
        </Field>
        <Field label="Categoría">
          <SelectField
            value="a"
            onChange={vi.fn()}
            options={[{ value: 'a', label: 'Compra' }, { value: 'b', label: 'Café' }]}
          />
        </Field>
      </Modal>,
    )
    expect(await auditar(baseElement)).toEqual([])
  })
})

describe('axe: sub-pestañas', () => {
  it('la barra de sub-pestañas se anuncia con su grupo y su estado', async () => {
    const { baseElement } = render(
      <SubTabs
        ariaLabel="Secciones de usuarios"
        activa="api"
        tabs={[
          { id: 'cuentas', label: 'Cuentas', href: '/app/panel?tab=usuarios', cuenta: 3 },
          { id: 'api', label: 'API', href: '/app/panel?tab=usuarios&u=api' },
        ]}
      />,
    )
    expect(await auditar(baseElement)).toEqual([])
  })
})

describe('axe: campos sueltos', () => {
  it('un select sin <label> visible se anuncia por aria-label', async () => {
    // Caso de las filas de una lista, donde la etiqueta sería ruido visual: el
    // nombre accesible tiene que venir de `ariaLabel`.
    const { baseElement } = render(
      <SelectField
        ariaLabel="Mover a estado"
        value="a"
        onChange={vi.fn()}
        options={[{ value: 'a', label: 'Contactada' }]}
      />,
    )
    expect(await auditar(baseElement)).toEqual([])
  })

  it('un buscador sin etiqueta visible tampoco se queda sin nombre', async () => {
    const { baseElement } = render(
      <TextField ariaLabel="Buscar movimientos" placeholder="Buscar..." value="" onChange={vi.fn()} />,
    )
    expect(await auditar(baseElement)).toEqual([])
  })
})
