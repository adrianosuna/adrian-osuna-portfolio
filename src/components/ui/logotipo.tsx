// El logo de la marca, inline y con `currentColor` para heredar el color del texto.
// Es decorativo (`aria-hidden`): el nombre lo pone el enlace que lo envuelve.
import { MARCA_ALTO, MARCA_ANCHO, MARCA_D } from '@/lib/marca'

export function Logotipo({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${MARCA_ANCHO} ${MARCA_ALTO}`}
      className={className}
      fill="currentColor"
      // Tres contornos y el tercero es el hueco de la A: con `nonzero` saldría
      // maciza. Ver la nota de `MARCA_D`.
      fillRule="evenodd"
      aria-hidden
      focusable="false">
      <path d={MARCA_D} />
    </svg>
  )
}
