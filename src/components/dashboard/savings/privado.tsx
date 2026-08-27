'use client'

// Modo privado del módulo de finanzas: los importes salen OCULTOS por defecto
// (difuminados, sin poder seleccionarse ni tocarse) y se revelan con el botón
// del ojo. La elección vive en sessionStorage: se mantiene al navegar entre
// pestañas, y cada sesión nueva del navegador vuelve a empezar oculta.
import { useSyncExternalStore } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btnOutline } from './comun'

const CLAVE = 'pf_finanzas_visible'

// Almacén externo mínimo (useSyncExternalStore): el valor vive en memoria y se
// persiste en sessionStorage cuando el navegador lo permite (en modo privado
// puede lanzar, y entonces la elección solo dura lo que dure la vista).
let visible: boolean | null = null
const suscriptores = new Set<() => void>()

const leer = () => {
  if (visible === null) {
    try {
      visible = sessionStorage.getItem(CLAVE) === '1'
    } catch {
      visible = false
    }
  }
  return visible
}

const escribir = (valor: boolean) => {
  visible = valor
  try {
    if (valor) sessionStorage.setItem(CLAVE, '1')
    else sessionStorage.removeItem(CLAVE)
  } catch {
    // Sin persistencia: el cambio vale para esta vista.
  }
  suscriptores.forEach((avisar) => avisar())
}

const suscribir = (avisar: () => void) => {
  suscriptores.add(avisar)
  return () => void suscriptores.delete(avisar)
}

/** ¿Están ocultos los importes? En el servidor, siempre sí: nunca se pinta un
 *  importe legible antes de hidratar. */
export const useOculto = () => !useSyncExternalStore(suscribir, leer, () => false)

/** Importe enmascarado cuando el modo privado está activo (para cifras que
 *  quedan fuera del envoltorio difuminado, como el modal de gestión de años). */
export const MASCARA = '••••'

/** Botón de ojo para mostrar/ocultar los importes. */
export function BotonPrivado() {
  const oculto = useOculto()
  return (
    <button
      type="button"
      className={cn(btnOutline, 'shrink-0')}
      aria-pressed={!oculto}
      title={oculto ? 'Mostrar los importes' : 'Ocultar los importes'}
      onClick={() => escribir(oculto)}>
      {oculto ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      <span className="sm:hidden">{oculto ? 'Mostrar importes' : 'Ocultar importes'}</span>
    </button>
  )
}

/** Importe suelto de otra página (la tarjeta de ahorro del inicio del
 *  dashboard): respeta la elección de la sesión, sin botón propio — se revela
 *  desde Finanzas. */
export function ImporteDeSesion({ valor }: { valor: string }) {
  const oculto = useOculto()
  return <span className={cn(oculto && 'select-none blur-[7px]')}>{valor}</span>
}

/** Envoltorio del contenido con importes: difumina cuando está oculto.
 *  `pointer-events-none` a propósito: editar sin ver sería un error fácil,
 *  así que primero se revela y luego se trabaja. */
export function ContenidoPrivado({ children }: { children: React.ReactNode }) {
  const oculto = useOculto()
  return (
    <div
      className={cn(
        'transition-[filter] duration-200',
        oculto && 'pointer-events-none select-none blur-[7px]',
      )}>
      {children}
    </div>
  )
}
