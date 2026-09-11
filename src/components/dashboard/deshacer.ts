'use client'

// Borrado con deshacer: se borra sin preguntar y el aviso ofrece la marcha atrás.
// Lo que no se puede devolver entero sigue preguntando con `useConfirmar`.
import { toast } from 'sonner'

/** Segundos que el aviso deja deshacer. */
const SEGUNDOS = 8

type Resultado<T> = { ok: boolean; message?: string; deshacer?: T }

/** Ejecuta un borrado y, si va bien, saca el aviso con "Deshacer". Si la
 *  restauración falla se avisa. */
export async function borrarConDeshacer<T>({
  borrar, restaurar, mensaje, alTerminar,
}: {
  borrar: () => Promise<Resultado<T>>
  restaurar: (datos: T) => Promise<{ ok: boolean; message?: string }>
  /** Texto del aviso ("Movimiento eliminado"). */
  mensaje: string
  /** Se llama tras borrar y tras deshacer (cerrar un modal, refrescar...). */
  alTerminar?: () => void
}): Promise<boolean> {
  const res = await borrar()
  if (!res.ok) {
    toast.error(res.message ?? 'Error')
    return false
  }
  alTerminar?.()

  const paquete = res.deshacer
  if (paquete === undefined) {
    // Sin paquete no hay marcha atrás: al menos se confirma el borrado.
    toast.success(mensaje)
    return true
  }

  toast.success(mensaje, {
    duration: SEGUNDOS * 1000,
    action: {
      label: 'Deshacer',
      onClick: () => {
        // El onClick del aviso no es async: se lanza y se informa al acabar.
        restaurar(paquete).then((r) => {
          if (r.ok) toast.success('Restaurado')
          else toast.error(r.message ?? 'No se pudo restaurar')
          alTerminar?.()
        })
      },
    },
  })
  return true
}
