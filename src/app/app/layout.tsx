// Layout del dashboard interno (/app/*): protegido por sesión. El menú es una
// barra superior (no hay menú lateral en escritorio, como el original).
//
// Aquí se montan también las piezas GLOBALES del dashboard, por orden: la barra
// de carga, las acciones rápidas (paleta ⌘K, alta rápida y atajos de teclado) y
// el diálogo de confirmaciones. Cualquier vista las usa por contexto.
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

  // Avisos para la campana de la barra superior. Son tres selects acotados (los
  // mismos criterios que la franja del inicio, vía `construirAvisos`), y se
  // calculan aquí porque la campana está en TODAS las páginas: pedirlos al
  // abrirla dejaría el contador en blanco justo cuando sirve para algo.
  const avisos = isAdmin ? await avisosPendientes() : []

  const cerrarSesion = async () => {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return (
    // min-w-0 en la cadena de flex: sin él, un hijo con anchura mínima grande
    // (p. ej. el tablero del pipeline con min-w-260 dentro de su scroller)
    // impediría encoger al layout entero y desbordaría la página en móvil.
    <div className="flex min-h-screen min-w-0 flex-col bg-muted/40">
      {/* La barra de carga (useSearchParams) va bajo Suspense por exigencia de
          Next; envuelve top-nav y contenido para que el contexto llegue a los
          tabs. */}
      <Suspense>
        <BarraCargaProvider>
          {/* Acciones globales (paleta ⌘K, alta rápida y atajos de teclado). */}
          <AccionesRapidasProvider isAdmin={isAdmin} hoy={hoyMadrid()}>
            {/* Confirmaciones destructivas en un solo diálogo (con "no volver a
                preguntar"): cualquier vista lo pide con `useConfirmar`. */}
            <ConfirmarProvider>
              {/* Service worker: pantalla offline y recepción de push. */}
              <RegistrarServiceWorker />
              {/* En su propio landmark: si no, su texto queda fuera de
                  cualquier región y un lector de pantalla que navegue por
                  landmarks no lo alcanza (axe: `region`).
                  ⚠ Sin `role="status"` AQUÍ: el rol implícito de `aside` es
                  `complementary` y no admite que se le sobrescriba con uno de
                  live region (axe: `aria-allowed-role`). El `role` va dentro,
                  en la propia franja. */}
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
