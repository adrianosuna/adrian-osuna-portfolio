// Tope de peticiones por ventana.
//
// Lo que importa probar aquí es que la ventana es **deslizante**: con ventanas
// por bloques fijos se pueden colar `2 × max` peticiones a caballo entre dos
// —todas al final de una y todas al principio de la siguiente—, que es el
// fallo clásico de esta técnica y no se ve a simple vista.
import { beforeEach, describe, expect, it } from 'vitest'
import {
  claveIp,
  limitar,
  LIMITE_ACCIONES,
  LIMITE_API,
  LIMITE_API_FALLIDO,
  LIMITE_LOGIN,
  reiniciarLimites,
} from '@/lib/rate-limit'

const LIM = { max: 3, ventanaMs: 1000 }
/** Reloj fijo: el límite no debe depender del reloj real para probarse. */
const T0 = 1_000_000

beforeEach(() => reiniciarLimites())

describe('la ventana', () => {
  it('deja pasar hasta el máximo y frena la siguiente', () => {
    for (let i = 0; i < LIM.max; i++) {
      expect(limitar('k', LIM, T0).ok, `petición ${i + 1}`).toBe(true)
    }
    const frenada = limitar('k', LIM, T0)
    expect(frenada.ok).toBe(false)
    expect(frenada.quedan).toBe(0)
    expect(frenada.esperaS).toBeGreaterThan(0)
  })

  it('va contando lo que queda', () => {
    expect(limitar('k', LIM, T0).quedan).toBe(2)
    expect(limitar('k', LIM, T0).quedan).toBe(1)
    expect(limitar('k', LIM, T0).quedan).toBe(0)
  })

  it('DESLIZA: al salir la más antigua de la ventana se abre un hueco', () => {
    // Tres peticiones repartidas y la cuarta frenada...
    limitar('k', LIM, T0)
    limitar('k', LIM, T0 + 300)
    limitar('k', LIM, T0 + 600)
    expect(limitar('k', LIM, T0 + 700).ok).toBe(false)

    // ...pero pasado un segundo desde la PRIMERA, esa ya no cuenta.
    expect(limitar('k', LIM, T0 + 1001).ok).toBe(true)
  })

  it('no permite el doble justo al cambiar de ventana', () => {
    // Con bloques fijos, estas seis pasarían (tres al final de un bloque y
    // tres al principio del siguiente). Con ventana deslizante, no.
    for (let i = 0; i < LIM.max; i++) limitar('k', LIM, T0 + 900 + i)
    let pasaron = 0
    for (let i = 0; i < LIM.max; i++) {
      if (limitar('k', LIM, T0 + 1000 + i).ok) pasaron++
    }
    expect(pasaron).toBe(0)
  })

  it('dice cuántos segundos hay que esperar', () => {
    for (let i = 0; i < LIM.max; i++) limitar('k', LIM, T0)
    // La primera sale de la ventana en 1 s → 1 segundo de espera.
    expect(limitar('k', LIM, T0 + 500).esperaS).toBe(1)
  })
})

describe('las claves son independientes', () => {
  it('un token desbocado no frena a otro', () => {
    for (let i = 0; i < LIM.max; i++) limitar('token-a', LIM, T0)
    expect(limitar('token-a', LIM, T0).ok).toBe(false)
    expect(limitar('token-b', LIM, T0).ok).toBe(true)
  })
})

describe('claveIp', () => {
  const con = (cabeceras: Record<string, string>) =>
    claveIp(new Request('http://x/api', { headers: cabeceras }), 'api')

  it('usa el PRIMER valor de X-Forwarded-For (el del cliente)', () => {
    // Los siguientes los añade quien reenvía: fiarse del último dejaría la
    // clave en la IP de Caddy y el límite sería global.
    expect(con({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' })).toBe('api:203.0.113.9')
  })

  it('cae a X-Real-IP y, sin nada, a una clave fija', () => {
    expect(con({ 'x-real-ip': '198.51.100.4' })).toBe('api:198.51.100.4')
    // En local todo viene del mismo sitio, así que agrupar da igual.
    expect(con({})).toBe('api:local')
  })
})

describe('los límites del proyecto', () => {
  it('el de fallos de la API es más estrecho que el de uso normal', () => {
    // Quien acierta el token entra por el normal; en el estrecho solo caen los
    // intentos que no valen.
    expect(LIMITE_API_FALLIDO.max).toBeLessThan(LIMITE_API.max)
  })

  it('ninguno estorba a un uso normal', () => {
    // Cifras de referencia: un login son 2-3 peticiones, y nadie pulsa 120
    // botones en un minuto.
    expect(LIMITE_LOGIN.max).toBeGreaterThanOrEqual(10)
    expect(LIMITE_ACCIONES.max).toBeGreaterThanOrEqual(60)
    for (const l of [LIMITE_API, LIMITE_API_FALLIDO, LIMITE_LOGIN, LIMITE_ACCIONES]) {
      expect(l.ventanaMs).toBeGreaterThan(0)
    }
  })
})

describe('reiniciarLimites', () => {
  it('olvida una clave concreta o todas', () => {
    for (let i = 0; i < LIM.max; i++) limitar('k', LIM, T0)
    expect(limitar('k', LIM, T0).ok).toBe(false)
    reiniciarLimites('k')
    expect(limitar('k', LIM, T0).ok).toBe(true)
  })
})
