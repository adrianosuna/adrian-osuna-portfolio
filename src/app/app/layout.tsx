// Layout del dashboard interno (/app/*): protegido por sesión. El menú es una
// barra superior (no hay menú lateral en escritorio, como el original).
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import { auth, signOut } from '@/auth'
import { TopNav } from '@/components/dashboard/top-nav'

// noindex: dashboard privado; la meta robots evita que se indexe si lo enlazan.
export const metadata: Metadata = { title: 'Dashboard', robots: { index: false, follow: false } }

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const cerrarSesion = async () => {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return (
    // min-w-0 en la cadena de flex: sin él, un hijo con anchura mínima grande
    // (p. ej. el tablero del pipeline con min-w-260 dentro de su scroller)
    // impediría encoger al layout entero y desbordaría la página en móvil.
    <div className="flex min-h-screen min-w-0 flex-col bg-muted/40">
      <TopNav
        user={{
          name: session.user.name ?? null,
          email: session.user.email ?? null,
          image: session.user.image ?? null,
          role: session.user.role,
        }}
        onSignOut={cerrarSesion}
      />
      <main className="mx-auto w-full min-w-0 max-w-300 flex-1 px-4 py-6 sm:px-6">{children}</main>
      <Toaster richColors position="bottom-right" theme="dark" />
    </div>
  )
}
