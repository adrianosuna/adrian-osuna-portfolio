'use client'

// Aviso de NOVEDADES: cuando la versión desplegada cambia respecto a la última
// que se vio en este navegador, sale una franja discreta. Es la forma de
// enterarse de que un despliegue ha entrado sin mirar el servidor.
//
// No toca la BD (ver `lib/preferencias.ts`): es cosa del dispositivo.
//
// Aquí vivía también un conmutador de DENSIDAD (tablas normales o compactas),
// retirado el 02/09/2026 con sus reglas de CSS: apretar las filas ahorraba unos
// píxeles y estropeaba el aspecto de todas las tablas, que es un mal cambio.
import { Sparkles, X } from 'lucide-react'
import { usePreferencia } from '@/lib/preferencias'

/**
 * Franja de novedades: aparece cuando la versión desplegada no es la última
 * vista en este navegador, y se va al cerrarla.
 *
 * No enlaza a ningún listado de cambios porque el proyecto no publica uno
 * (el CHANGELOG vive en el repositorio, no en el sitio): el aviso dice QUE hay
 * versión nueva, que es la parte que no se puede saber desde dentro de la app.
 */
export function AvisoNovedades({ version }: { version: string }) {
  const [vista, setVista] = usePreferencia<string>('version-vista', '')

  // Mientras no se haya hidratado, `vista` vale '' y la franja saldría siempre;
  // se acepta porque se cierra sola al primer clic y no tapa nada.
  if (vista === version) return null

  return (
    // `role="status"`: un aviso que aparece solo tiene que anunciarse solo.
    <div role="status" className="border-b border-primary/20 bg-primary/10">
      <div className="mx-auto flex w-full max-w-300 items-center gap-2.5 px-4 py-2 sm:px-6">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-[13px]">
          <span className="font-semibold">Versión {version} desplegada.</span>{' '}
          <span className="text-muted-foreground">
            Si algo se ve raro, recarga con Ctrl+F5.
          </span>
        </p>
        <button
          type="button"
          // p-2.5 en móvil (40px): 28 era un objetivo táctil corto.
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-sm:p-2.5"
          aria-label="Cerrar el aviso de novedades"
          onClick={() => setVista(version)}>
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
