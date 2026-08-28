// serieDiaria: la parte con lógica del port de `dailyTrend` (proyecto de
// Inversiones). Tres cosas importan aquí:
//   · RELLENAR LOS HUECOS — un día sin visitas aparece a cero, no se salta.
//   · Las marcas de mes, sin solaparse cuando el primer mes entra parcial.
//   · La agrupación por SEMANA cuando el rango es largo (más de 45 días).
import { describe, expect, it } from 'vitest'
import { serieDiaria } from '@/lib/serie-diaria'

const dias = (...fechas: string[]) => fechas.map((fecha) => ({ fecha }))

/** Serie continua de N días desde una fecha (para probar los umbrales). */
const rango = (desde: string, n: number) => {
  const d = new Date(`${desde}T00:00:00Z`)
  return Array.from({ length: n }, () => {
    const fecha = d.toISOString().slice(0, 10)
    d.setUTCDate(d.getUTCDate() + 1)
    return { fecha }
  })
}

describe('por día', () => {
  it('rellena los días que faltan entre el primero y el último', () => {
    const s = serieDiaria(dias('2026-08-01', '2026-08-05'))
    expect(s.columnas).toEqual([
      '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05',
    ])
    expect(s.porSemana).toBe(false)
  })

  it('los días sin dato quedan con grupo vacío (suman cero, no se saltan)', () => {
    const s = serieDiaria(dias('2026-08-01', '2026-08-04'))
    expect(s.grupos).toEqual([[0], [], [], [1]])
  })

  it('el eje X va en DD/MM y el tooltip en texto largo', () => {
    const s = serieDiaria(dias('2026-08-03'))
    expect(s.ejeX).toEqual(['03/08'])
    expect(s.largas).toEqual(['Lunes 3 de Agosto'])
  })

  it('cruza el cambio de mes sin desfase de zona horaria', () => {
    const s = serieDiaria(dias('2026-03-28', '2026-03-31'))
    expect(s.columnas).toEqual(['2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31'])
    expect(s.ejeX).toEqual(['28/03', '29/03', '30/03', '31/03'])
  })
})

describe('agrupación automática', () => {
  it('45 días o menos: una columna por día', () => {
    const s = serieDiaria(rango('2026-06-01', 45))
    expect(s.porSemana).toBe(false)
    expect(s.columnas).toHaveLength(45)
  })

  it('más de 45 días: una columna por semana', () => {
    const s = serieDiaria(rango('2026-06-01', 46))
    expect(s.porSemana).toBe(true)
    expect(s.columnas.length).toBeLessThan(10)
  })

  it('90 días se resumen en columnas semanales sin perder ningún día', () => {
    const s = serieDiaria(rango('2026-05-30', 90))
    expect(s.porSemana).toBe(true)
    expect(s.columnas.length).toBeLessThanOrEqual(14)
    expect(s.grupos.flat()).toHaveLength(90)
  })

  it('las columnas semanales empiezan en LUNES', () => {
    // 2026-05-30 es sábado: su semana empieza el lunes 25.
    const s = serieDiaria(rango('2026-05-30', 60))
    expect(s.columnas[0]).toBe('2026-05-25')
    for (const k of s.columnas) {
      expect(new Date(`${k}T00:00:00Z`).getUTCDay()).toBe(1)
    }
  })

  it('el tooltip semanal dice "Semana del…"', () => {
    const s = serieDiaria(rango('2026-08-03', 60))
    expect(s.largas[0]).toBe('Semana del 3 de Agosto')
  })

  it('se puede forzar el modo, sin depender del umbral', () => {
    expect(serieDiaria(rango('2026-08-01', 10), { agrupar: 'semana' }).porSemana).toBe(true)
    expect(serieDiaria(rango('2026-01-01', 200), { agrupar: 'dia' }).porSemana).toBe(false)
  })
})

describe('marcas de mes', () => {
  it('marca el primer día de cada mes, con el año en la primera marca', () => {
    const s = serieDiaria(dias('2026-07-01', '2026-09-02'), { agrupar: 'dia' })
    expect(Object.values(s.marcasMes)).toEqual(['Julio 2026', 'Agosto', 'Septiembre'])
    expect(s.marcasMes[0]).toBe('Julio 2026')
  })

  it('NO marca el primer mes si entra parcial: se solapaba con la siguiente', () => {
    const s = serieDiaria(dias('2026-05-30', '2026-08-27'), { agrupar: 'dia' })
    expect(Object.values(s.marcasMes)).toEqual(['Junio 2026', 'Julio', 'Agosto'])
    expect(s.marcasMes[0]).toBeUndefined()
  })

  it('el cruce de año: el año va en la primera marca visible y al cambiar', () => {
    expect(
      Object.values(serieDiaria(dias('2026-12-30', '2027-01-20'), { agrupar: 'dia' }).marcasMes),
    ).toEqual(['Enero 2027'])
    expect(
      Object.values(serieDiaria(dias('2026-12-01', '2027-01-20'), { agrupar: 'dia' }).marcasMes),
    ).toEqual(['Diciembre 2026', 'Enero 2027'])
  })

  it('una serie corta dentro de un solo mes conserva su marca (no eje vacío)', () => {
    const s = serieDiaria(dias('2026-08-21', '2026-08-27'))
    expect(Object.values(s.marcasMes)).toEqual(['Agosto 2026'])
  })
})

describe('sin datos', () => {
  it('no revienta: todo vacío', () => {
    const s = serieDiaria([])
    expect(s.columnas).toEqual([])
    expect(s.grupos).toEqual([])
    expect(s.marcasMes).toEqual({})
    expect(s.porSemana).toBe(false)
  })
})
