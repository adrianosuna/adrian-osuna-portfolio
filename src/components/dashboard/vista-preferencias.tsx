'use client'

// Aviso de novedades: cuando la versión desplegada cambia respecto a la última vista
// en este navegador. Cosa del dispositivo (`lib/preferencias.ts`), no de la BD.
import { Sparkles, X } from 'lucide-react'
import { usePreferencia } from '@/lib/preferencias'

/** Franja de novedades: sale cuando la versión desplegada no es la última vista y
 *  se va al cerrarla. No enlaza a un listado: el proyecto no publica uno. */
export function AvisoNovedades({ version }: { version: string }) {
  const [vista, setVista] = usePreferencia<string>('version-vista', '')

  // Mientras no se haya hidratado, `vista` vale '' y la franja saldría siempre;
  // se acepta porque se cierra sola al primer clic y no tapa nada.
  if (vista === version) return null

  return (
    // `role="status"`: un aviso que aparece solo tiene que anunciarse solo.
    <div role="status" className="border-b border-white/8 bg-white/4">
      <div className="safe-x flex w-full items-center gap-2.5 py-2">
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
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground max-sm:p-2.5"
          aria-label="Cerrar el aviso de novedades"
          onClick={() => setVista(version)}>
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
