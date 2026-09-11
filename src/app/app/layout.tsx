// Layout del dashboard (/app/*), protegido por sesión. Monta las piezas globales:
// barra de carga, acciones rápidas (⌘K, alta rápida, atajos) y confirmaciones.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import pkg from '../../../package.json'
import { auth, signOut } from '@/auth'
import { hoyMadrid } from '@/lib/mantenimiento'
import { avisosPendientes } from '@/lib/inicio'
import { TopNav } from '@/components/dashboard/top-nav'
import { BarraCargaProvider } from '@/components/dashboard/barra-carga'
import { AccionesRapidasProvider } from '@/components/dashboard/acciones-rapidas'
import { ConfirmarProvider } from '@/components/dashboard/confirmar'
import { AvisoNovedades } from '@/components/dashboard/vista-preferencias'
import { RegistrarServiceWorker } from '@/components/dashboard/push'

// noindex: dashboard privado; la meta robots evita que se indexe si lo enlazan.
export const metadata: Metadata = { title: 'Dashboard', robots: { index: false, follow: false } }

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const isAdmin = session.user.role === 'ADMIN'

  // Avisos para la campana: tres selects acotados (los de la franja del inicio, vía
  // `construirAvisos`). Van aquí porque la campana está en todas las páginas.
  const avisos = isAdmin ? await avisosPendientes() : []

  const cerrarSesion = async () => {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return (
    // min-w-0 en la cadena de flex: sin él un hijo con anchura mínima grande (el
    // tablero del pipeline) impide encoger al layout y desborda en móvil.
    <div className="flex min-h-screen min-w-0 flex-col bg-muted/40">
      {/* La barra de carga (useSearchParams) va bajo Suspense por exigencia de Next;
          envuelve top-nav y contenido para que el contexto llegue a los tabs. */}
      <Suspense>
        <BarraCargaProvider>
          {/* Acciones globales (paleta ⌘K, alta rápida y atajos de teclado). */}
          <AccionesRapidasProvider isAdmin={isAdmin} hoy={hoyMadrid()}>
            {/* Confirmaciones destructivas en un solo diálogo (con "no volver a
                preguntar"): cualquier vista lo pide con `useConfirmar`. */}
            <ConfirmarProvider>
              {/* Service worker: pantalla offline y recepción de push. */}
              <RegistrarServiceWorker />
              {/* En su propio landmark para que un lector de pantalla lo alcance (axe: region).
                  Sin role="status" aquí: aside es complementary y no admite live region. */}
              <aside aria-label="Avisos de la aplicación">
                <AvisoNovedades version={pkg.version} />
              </aside>
              <TopNav
                user={{
                  name: session.user.name ?? null,
                  email: session.user.email ?? null,
                  image: session.user.image ?? null,
                  role: session.user.role,
                }}
                avisos={avisos}
                onSignOut={cerrarSesion}
              />
              {/* safe-x / safe-bottom: en apaisado el recorte se come un
                  costado, y abajo está la barra de gestos del iPhone. */}
              <main className="safe-x safe-bottom mx-auto w-full min-w-0 max-w-300 flex-1 pt-6">
                {children}
              </main>
            </ConfirmarProvider>
          </AccionesRapidasProvider>
        </BarraCargaProvider>
      </Suspense>
      <Toaster richColors position="bottom-right" theme="dark" />
    </div>
  )
}
