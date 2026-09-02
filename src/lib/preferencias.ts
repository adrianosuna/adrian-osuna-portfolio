'use client'

// Preferencias de INTERFAZ, guardadas en el navegador (localStorage).
//
// ⚠ Esto NO resucita el "modo privado" ni los ajustes por usuario en BD que se
// retiraron de raíz el 31/08/2026 (columna `user.prefs` incluida). La
// diferencia es deliberada: aquí solo viven comodidades de la vista —accesos
// fijados del inicio, confirmaciones silenciadas, la versión ya vista—, que son
// de ESTE dispositivo, no del usuario. Nada de esto
// cambia datos ni permisos, así que no tiene por qué viajar al servidor ni
// ocupar una columna.
//
// Se lee con `useSyncExternalStore` y no con un efecto a propósito: leer
// localStorage en un `useEffect` obliga a un `setState` síncrono dentro del
// efecto, que es justo lo que prohíbe el React Compiler (`set-state-in-effect`).
// Además así el valor se comparte entre todos los componentes que lo usan y se
// sincroniza entre pestañas (evento `storage`).
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
// IDENTIDAD mientras el valor no cambie (si no, React entra en bucle con los
// objetos y arrays). Se guarda el crudo leído para saber si sigue vigente.
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

/**
 * Preferencia de interfaz reactiva: `[valor, cambiar]`.
 *
 * En el servidor (y en el primer render del cliente) devuelve `inicial`, así
 * que la hidratación cuadra; el valor guardado entra en el render siguiente.
 * Por eso lo que dependa de esto no debe ser el contenido principal de la
 * página, solo su presentación.
 */
export function usePreferencia<T>(clave: string, inicial: T): [T, (v: T) => void] {
  const valor = useSyncExternalStore(
    suscribir,
    () => leer(clave, inicial),
    () => inicial,
  )
  const cambiar = useCallback((v: T) => guardarPreferencia(clave, v), [clave])
  return [valor, cambiar]
}
