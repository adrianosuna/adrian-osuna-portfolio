// Página que sirve el service worker sin red. No intenta ser la app: evita el
// error en blanco y ofrece volver a intentarlo.
import type { Metadata } from 'next'
import { WifiOff } from 'lucide-react'
import { ReintentarOffline } from '@/components/dashboard/reintentar-offline'

export const metadata: Metadata = {
  title: 'Sin conexión',
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <WifiOff className="size-7" />
      </span>
      <h1 className="mt-5 text-xl font-bold">Sin conexión</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        No se ha podido cargar esta pantalla. El dashboard lee sus datos del servidor, así que
        necesita red para mostrarlos.
      </p>
      <ReintentarOffline />
    </main>
  )
}
