// El logo de la marca, para la interfaz. El trazo vive en `lib/marca.ts`.
//
// Va INLINE y no como <img src="/logo.svg">: así hereda el color del texto con
// `currentColor` —la barra de la landing, el login y el dashboard lo pintan
// cada uno con el suyo—, no cuesta una petición más y no parpadea al cargar.
//
// ⚠ Es DECORATIVO (`aria-hidden`): el nombre accesible lo pone el enlace que
// lo envuelve con su `aria-label`. Un SVG sin texto dentro de un enlace sin
// etiqueta deja el enlace SIN NOMBRE, que es justo lo que cazó `link-name` de
// axe al sustituir el «AO.» de texto — aquel se nombraba solo.
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
