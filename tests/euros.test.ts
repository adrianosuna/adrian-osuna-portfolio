// Formato de importes de finanzas: la regla es "decimales SOLO si el importe
// los tiene". Antes se redondeaba a euros y un gasto de 12,50 € se veía como
// 13 €, que descuadraba las cuentas a ojo.
//
// Ojo con el espacio: Intl en es-ES separa la cifra del € con un espacio
// IRROMPIBLE (U+00A0), no con uno normal, así que las comparaciones lo usan.
import { describe, expect, it } from 'vitest'
import { eur, num, redondearCentimos, tieneCentimos } from '@/lib/euros'

const NB = ' ' // espacio irrompible

describe('eur', () => {
  it('sin céntimos no pinta decimales', () => {
    expect(eur(60)).toBe(`60${NB}€`)
    expect(eur(0)).toBe(`0${NB}€`)
    expect(eur(1850)).toBe(`1.850${NB}€`)
  })

  it('con céntimos pinta exactamente dos', () => {
    expect(eur(12.5)).toBe(`12,50${NB}€`) // no "12,5 €"
    expect(eur(45.8)).toBe(`45,80${NB}€`)
    expect(eur(1234.56)).toBe(`1.234,56${NB}€`)
  })

  it('agrupa siempre los miles (es-ES no lo hace con 4 cifras)', () => {
    // El motivo original de `useGrouping: 'always'`: "3950 €" junto a "12.750 €".
    expect(eur(3950)).toBe(`3.950${NB}€`)
  })

  it('redondea a céntimos lo que trae más decimales (medias, proyecciones)', () => {
    expect(eur(45.804)).toBe(`45,80${NB}€`)
    expect(eur(45.806)).toBe(`45,81${NB}€`)
  })

  it('el ruido binario no saca un ",00" de la nada', () => {
    // Una suma de decimales puede dar 100.00000000000001: sigue siendo 100 €.
    expect(eur(100.000000000000014)).toBe(`100${NB}€`)
    expect(eur(0.1 + 0.2)).toBe(`0,30${NB}€`)
  })

  it('negativos y nulos', () => {
    expect(eur(-45.8)).toBe(`-45,80${NB}€`)
    expect(eur(null)).toBe('—')
    expect(eur(undefined)).toBe('—')
    expect(eur(Number.NaN)).toBe('—')
  })
})

describe('num (sin símbolo)', () => {
  it('misma regla, sin el €', () => {
    expect(num(60)).toBe('60')
    expect(num(12.5)).toBe('12,50')
    expect(num(3950)).toBe('3.950')
    expect(num(null)).toBe('—')
  })
})

describe('tieneCentimos y redondearCentimos', () => {
  it('detecta los céntimos ignorando el ruido binario', () => {
    expect(tieneCentimos(60)).toBe(false)
    expect(tieneCentimos(60.5)).toBe(true)
    expect(tieneCentimos(100.000000000000014)).toBe(false)
    expect(tieneCentimos(0.004)).toBe(false) // se redondea a 0 céntimos
  })

  it('redondea a dos decimales', () => {
    expect(redondearCentimos(12.499)).toBe(12.5)
    expect(redondearCentimos(0.1 + 0.2)).toBe(0.3)
    expect(redondearCentimos(45.806)).toBe(45.81)
  })
})
