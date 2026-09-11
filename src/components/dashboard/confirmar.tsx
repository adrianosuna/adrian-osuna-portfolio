'use client'

// Confirmaciones destructivas en un diálogo con promesa. Con `clave` ofrece "No
// volver a preguntar" (localStorage, restablecible). Los borrados con deshacer no lo usan.
import { createContext, useCallback, useContext, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { usePreferencia, leerPreferencia, guardarPreferencia } from '@/lib/preferencias'
import { btnOutline, btnPrimary } from '@/components/ui/botones'

/** Clave de la preferencia con las confirmaciones silenciadas (una lista). */
const CLAVE_SILENCIADAS = 'confirmaciones-silenciadas'

export interface Peticion {
  titulo: string
  /** Qué va a pasar, en una frase. */
  texto: string
  /** Texto del botón que confirma (por defecto "Eliminar"). */
  etiqueta?: string
  /** Rojo (borrado) o neutro (una acción que solo conviene revisar). */
  peligro?: boolean
  /** Identificador de esta clase de acción: con él aparece "No volver a preguntar";
   *  sin él el aviso siempre sale. */
  clave?: string
}

const Ctx = createContext<(p: Peticion) => Promise<boolean>>(async () => true)

/** Pide confirmación. Devuelve `true` si se confirma (o si está silenciada). */
export const useConfirmar = () => useContext(Ctx)

/** ¿Hay alguna confirmación silenciada? (para ofrecer restablecerlas) */
export function useSilenciadas(): [string[], () => void] {
  const [lista] = usePreferencia<string[]>(CLAVE_SILENCIADAS, [])
  const restablecer = useCallback(() => guardarPreferencia(CLAVE_SILENCIADAS, []), [])
  return [lista, restablecer]
}

export function ConfirmarProvider({ children }: { children: React.ReactNode }) {
  const [pendiente, setPendiente] = useState<{
    peticion: Peticion
    resolver: (v: boolean) => void
  } | null>(null)
  const [noPreguntar, setNoPreguntar] = useState(false)

  const confirmar = useCallback((peticion: Peticion) => {
    // Silenciada: se da por confirmada sin abrir nada.
    if (peticion.clave) {
      const silenciadas = leerPreferencia<string[]>(CLAVE_SILENCIADAS, [])
      if (silenciadas.includes(peticion.clave)) return Promise.resolve(true)
    }
    setNoPreguntar(false)
    return new Promise<boolean>((resolver) => setPendiente({ peticion, resolver }))
  }, [])

  const cerrar = (confirmado: boolean) => {
    if (!pendiente) return
    if (confirmado && noPreguntar && pendiente.peticion.clave) {
      const silenciadas = leerPreferencia<string[]>(CLAVE_SILENCIADAS, [])
      guardarPreferencia(CLAVE_SILENCIADAS, [...silenciadas, pendiente.peticion.clave])
    }
    pendiente.resolver(confirmado)
    setPendiente(null)
  }

  const p = pendiente?.peticion
  return (
    <Ctx.Provider value={confirmar}>
      {children}
      {p && (
        <Modal
          title={p.titulo}
          onClose={() => cerrar(false)}
          footer={
            <>
              <button
                type="button"
                className={btnOutline}
                onClick={() => cerrar(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className={cn(
                  btnPrimary,
                  // Igual que el primario: texto oscuro sobre el color, porque el
                  // blanco sobre `--danger` no llega al contraste AA.
                  p.peligro === false ? 'bg-primary' : 'bg-danger',
                )}
                onClick={() => cerrar(true)}>
                {p.etiqueta ?? 'Eliminar'}
              </button>
            </>
          }>
          <p className="text-sm">{p.texto}</p>
          {p.clave && (
            // En móvil la fila crece: la casilla sola son 16px de objetivo.
            <label className="mt-4 flex cursor-pointer items-center gap-2 py-1 text-[13px] text-muted-foreground max-sm:gap-3 max-sm:py-2.5">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)] max-sm:size-5"
                checked={noPreguntar}
                onChange={(e) => setNoPreguntar(e.target.checked)}
              />
              No volver a preguntar por esto
            </label>
          )}
        </Modal>
      )}
    </Ctx.Provider>
  )
}
