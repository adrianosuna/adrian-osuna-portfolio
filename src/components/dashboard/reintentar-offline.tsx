'use client'

// Botón de reintento de la página offline. Va aparte porque la página es un
// componente de servidor y esto necesita `location.reload()`.
import { RefreshCw } from 'lucide-react'
import { btnPrimary } from '@/components/ui/botones'

export function ReintentarOffline() {
  return (
    <button type="button" className={`${btnPrimary} mt-6`} onClick={() => location.reload()}>
      <RefreshCw className="size-4" />
      Reintentar
    </button>
  )
}
