'use client'

// Preferencias de interfaz en localStorage: cosas de este dispositivo, no del usuario
// (no es el modo privado retirado). Con `useSyncExternalStore`, no un efecto.
import { useCallback, useSyncExternalStore } from 'react'

const PREFIJO = 'ao:'

const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((o) => o())

function suscribir(cb: () => void) {
  oyentes.add(cb)
  // Otra pestaña cambió la preferencia: esta se entera.
  window.addEventListener('storage', cb)
  return () => {
    oyentes.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

// Caché por clave: `useSyncExternalStore` exige que el snapshot mantenga la
// identidad mientras el valor no cambie, o React entra en bucle.
const cache = new Map<string, { crudo: string | null; valor: unknown }>()

function leer<T>(clave: string, inicial: T): T {
  let crudo: string | null = null
  try {
    crudo = localStorage.getItem(PREFIJO + clave)
  } catch {
    // Navegador con el almacenamiento bloqueado: se usa el valor por defecto.
    return inicial
  }
  const previo = cache.get(clave)
  if (previo && previo.crudo === crudo) return previo.valor as T
  let valor = inicial
  if (crudo !== null) {
    try {
      valor = JSON.parse(crudo) as T
    } catch {
      valor = inicial // basura en el almacén: se ignora
    }
  }
  cache.set(clave, { crudo, valor })
  return valor
}

/** Escribe una preferencia (y despierta a quien la esté usando). */
export function guardarPreferencia<T>(clave: string, valor: T) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor))
  } catch {
    // Sin almacenamiento la preferencia no persiste; la UI sigue funcionando.
  }
  cache.delete(clave)
  avisar()
}

/** Lee una preferencia sin suscribirse (para manejadores de eventos). */
export function leerPreferencia<T>(clave: string, inicial: T): T {
  if (typeof window === 'undefined') return inicial
  return leer(clave, inicial)
}

/** Preferencia de interfaz reactiva: `[valor, cambiar]`. En el servidor y el primer
 *  render devuelve `inicial` para que la hidratación cuadre. */
export function usePreferencia<T>(clave: string, inicial: T): [T, (v: T) => void] {
  const valor = useSyncExternalStore(
    suscribir,
    () => leer(clave, inicial),
    () => inicial,
  )
  const cambiar = useCallback((v: T) => guardarPreferencia(clave, v), [clave])
  return [valor, cambiar]
}
