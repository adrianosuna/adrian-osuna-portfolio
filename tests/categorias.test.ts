// Presentación de las categorías con grupos (`lib/categorias.ts`): la lista que
// se ofrece al apuntar un movimiento y la etiqueta con la que se lee.
//
// Es un solo sitio y lo comparten TRES desplegables (alta y edición de la
// tabla de gastos, acciones rápidas y recurrentes) más la lista de Ajustes y
// el correo de los topes, así que lo que se afirme aquí vale para todos.
import { describe, expect, it } from 'vitest'
import { arbolDeCategoria, esGrupo, etiquetaCategoria, opcionesDeCategoria } from '@/lib/categorias'

const cat = (
  uuid: string,
  name: string,
  extra: { isGroup?: boolean; parentName?: string | null; type?: 'GASTO' | 'INGRESO' } = {},
) => ({
  uuid,
  name,
  isGroup: extra.isGroup ?? false,
  parentName: extra.parentName ?? null,
  type: extra.type ?? ('GASTO' as const),
})

describe('esGrupo', () => {
  it('lee la MARCA, no si tiene categorías dentro', () => {
    // Un grupo recién creado está vacío: si "grupo" se dedujera de tener
    // hijas, este pasaría por categoría y se ofrecería al apuntar.
    expect(esGrupo(cat('vacio', 'Coche', { isGroup: true }))).toBe(true)
    expect(esGrupo(cat('suelta', 'Casa'))).toBe(false)
  })
})

describe('etiquetaCategoria', () => {
  it('una categoría en un grupo se lee "Coche › Taller"', () => {
    expect(etiquetaCategoria(cat('t', 'Taller', { parentName: 'Coche' }))).toBe('Coche › Taller')
  })

  it('una categoría SUELTA se lee con su nombre, sin adornos', () => {
    expect(etiquetaCategoria(cat('c', 'Casa'))).toBe('Casa')
  })
})

describe('opcionesDeCategoria', () => {
  const lista = [
    cat('coche', 'Coche', { isGroup: true }),
    cat('taller', 'Taller', { parentName: 'Coche' }),
    cat('casa', 'Casa'),
    cat('vacio', 'Sin nada', { isGroup: true }),
    cat('nomina', 'Nómina', { type: 'INGRESO' }),
  ]

  // Lo que se preguntó y por lo que existe este fichero: agrupar es OPCIONAL.
  // Una categoría que no está en ningún grupo se apunta como siempre.
  it('ofrece las categorías SUELTAS igual que las agrupadas', () => {
    const opciones = opcionesDeCategoria(lista, 'GASTO')
    expect(opciones.map((o) => o.label)).toEqual(['Sin categoría', 'Coche › Taller', 'Casa'])
  })

  it('NO ofrece los grupos, ni los vacíos', () => {
    const valores = opcionesDeCategoria(lista, 'GASTO').map((o) => o.value)
    expect(valores).not.toContain('coche')
    expect(valores).not.toContain('vacio')
  })

  it('respeta el tipo: a un ingreso no se le ofrece un gasto', () => {
    expect(opcionesDeCategoria(lista, 'INGRESO').map((o) => o.label)).toEqual([
      'Sin categoría',
      'Nómina',
    ])
  })

  it('"Sin categoría" va primero y siempre: dejarla en blanco es legítimo', () => {
    expect(opcionesDeCategoria([], 'GASTO')).toEqual([{ value: '', label: 'Sin categoría' }])
  })

  it('la etiqueta lleva la ruta COMPLETA, que es por lo que la lista es plana', () => {
    // El buscador del SelectField filtra por la etiqueta: escribir "coche"
    // tiene que sacar las categorías de ese grupo, y con <optgroup> no pasaría.
    const opciones = opcionesDeCategoria(lista, 'GASTO')
    const coincidencias = opciones.filter((o) => o.label.toLowerCase().includes('coche'))
    expect(coincidencias.map((o) => o.value)).toEqual(['taller'])
  })
})

// El ÁRBOL que consume el TreeSelectField: misma regla que la lista plana
// (sueltas y agrupadas sí, grupos nunca como opción) con otra forma.
describe('arbolDeCategoria', () => {
  const conPadre = (
    uuid: string,
    name: string,
    extra: { isGroup?: boolean; parentUuid?: string | null; type?: 'GASTO' | 'INGRESO' } = {},
  ) => ({ ...cat(uuid, name, { isGroup: extra.isGroup, type: extra.type }), parentUuid: extra.parentUuid ?? null })

  const lista = [
    conPadre('coche', 'Coche', { isGroup: true }),
    conPadre('taller', 'Taller', { parentUuid: 'coche' }),
    conPadre('gasolina', 'Gasolina', { parentUuid: 'coche' }),
    conPadre('casa', 'Casa'),
    conPadre('vacio', 'Sin nada', { isGroup: true }),
    conPadre('nomina', 'Nómina', { type: 'INGRESO' }),
  ]

  it('"Sin categoría" primero, el grupo con sus hijas dentro y la suelta al nivel', () => {
    expect(arbolDeCategoria(lista, 'GASTO')).toEqual([
      { value: '', label: 'Sin categoría' },
      { value: 'coche', label: 'Coche', hijos: [
        { value: 'taller', label: 'Taller' },
        { value: 'gasolina', label: 'Gasolina' },
      ] },
      { value: 'casa', label: 'Casa' },
    ])
  })

  it('un grupo VACÍO no sale: una cabecera sin nada debajo solo confunde', () => {
    expect(arbolDeCategoria(lista, 'GASTO').map((n) => n.value)).not.toContain('vacio')
  })

  it('respeta el tipo', () => {
    expect(arbolDeCategoria(lista, 'INGRESO')).toEqual([
      { value: '', label: 'Sin categoría' },
      { value: 'nomina', label: 'Nómina' },
    ])
  })
})
