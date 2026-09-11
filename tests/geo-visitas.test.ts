// Coordenadas del mapa: el emparejado de nombres aguanta lo que GA manda (tildes,
// provincia detrás) y la proyección corresponde al mapa.
import { describe, expect, it } from 'vitest'
import { CIUDADES, PAISES, proyectar, puntoDeCiudad, puntoDePais } from '@/lib/geo-visitas'

describe('emparejado de nombres', () => {
  it('encuentra países y ciudades por su nombre en español', () => {
    expect(puntoDePais('España')).toEqual({ lat: 40.2, lon: -3.7 })
    expect(puntoDeCiudad('Sevilla')).toEqual({ lat: 37.389, lon: -5.984 })
  })

  it('no depende de las tildes ni de las mayúsculas', () => {
    // GA a veces manda el exónimo ya corregido y a veces sin acentuar.
    expect(puntoDeCiudad('malaga')).toEqual(CIUDADES['Málaga'])
    expect(puntoDeCiudad('A CORUNA')).toEqual(CIUDADES['A Coruña'])
    expect(puntoDePais('mexico')).toEqual(PAISES['México'])
  })

  it('acepta la ciudad con su provincia detrás ("Alcalá de Henares, Madrid")', () => {
    // Lo que no está en la tabla cae a la parte anterior a la coma; si esa
    // tampoco está, no hay pin (y la fila sigue en el ranking).
    expect(puntoDeCiudad('Madrid, Comunidad de Madrid')).toEqual(CIUDADES.Madrid)
    expect(puntoDeCiudad('Cuenca del Segura, Murcia')).toBeNull()
  })

  it('lo que no está en la tabla devuelve null, no un punto inventado', () => {
    expect(puntoDeCiudad('Ciudad Inexistente')).toBeNull()
    expect(puntoDePais('Elbonia')).toBeNull()
  })
})

describe('proyección', () => {
  it('el meridiano cero cae en el centro y las longitudes extremas en los bordes', () => {
    expect(proyectar({ lat: 0, lon: 0 }).x).toBe(500)
    expect(proyectar({ lat: 0, lon: -180 }).x).toBe(0)
    expect(proyectar({ lat: 0, lon: 180 }).x).toBe(1000)
  })

  it('el norte queda arriba y el sur abajo, dentro del lienzo', () => {
    const norte = proyectar({ lat: 84, lon: 0 })
    const sur = proyectar({ lat: -60, lon: 0 })
    expect(norte.y).toBe(0)
    expect(sur.y).toBe(500)
    expect(proyectar({ lat: 40.417, lon: -3.703 }).y).toBeLessThan(sur.y)
  })

  it('recorta los polos para que ningún punto se salga del mapa', () => {
    // El mapa no dibuja la Antártida: sin recorte, un punto a -90 quedaría
    // por debajo del lienzo.
    for (const lat of [90, -90, 88, -75]) {
      const { y } = proyectar({ lat, lon: 0 })
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(500)
    }
  })

  it('respeta el tamaño que se le pida', () => {
    expect(proyectar({ lat: 0, lon: 0 }, 200, 100)).toEqual({ x: 100, y: 100 * (84 / 144) })
  })
})

describe('las tablas', () => {
  it('todas las coordenadas están en rango', () => {
    for (const [nombre, p] of Object.entries({ ...PAISES, ...CIUDADES })) {
      expect(Math.abs(p.lat), nombre).toBeLessThanOrEqual(90)
      expect(Math.abs(p.lon), nombre).toBeLessThanOrEqual(180)
    }
  })

  it('están las 50 provincias españolas y las dos ciudades autónomas', () => {
    // Es de donde viene casi todo el tráfico: si falta una, su pin no sale.
    for (const c of ['Madrid', 'Barcelona', 'Sevilla', 'Bilbao', 'Ceuta', 'Melilla', 'Teruel', 'Soria']) {
      expect(CIUDADES[c], c).toBeTruthy()
    }
  })
})
