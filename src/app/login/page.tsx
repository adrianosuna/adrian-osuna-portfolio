// Acceso al dashboard: solo con Google y por lista de invitados (allowlist).
// Mismo estilo que la landing: tarjeta `.pf-card` sobre rejilla y halo.
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, FlaskConical, ShieldCheck } from 'lucide-react'
import { FaGoogle } from 'react-icons/fa6'
import { auth, signIn } from '@/auth'
import { correoDevLogin } from '@/lib/dev-login'
import { Logotipo } from '@/components/ui/logotipo'

// noindex: el Disallow de robots.txt impide rastrear, pero no indexar si
// alguien enlaza la página; la meta robots sí.
export const metadata: Metadata = { title: 'Acceso', robots: { index: false, follow: false } }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (session?.user) redirect('/app')
  const { error } = await searchParams
  // Atajo de desarrollo (ver `lib/dev-login.ts`): null en producción siempre.
  const devLogin = correoDevLogin()

  return (
    // `main` y no `div`: sin un landmark, un lector de pantalla no puede
    // saltar al contenido — lo caza `landmark-one-main` de axe.
    <main className="pf-public relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 text-body">
      <div aria-hidden="true" className="pf-grid absolute inset-0 mask-[radial-gradient(ellipse_60%_60%_at_50%_40%,#000_10%,transparent_75%)]" />
      <div aria-hidden="true" className="pf-hero-glow" />
      <div className="superficie relative w-full max-w-sm rounded-2xl p-8 text-center">
        {/* La marca, decorativa: quien lea la pantalla ya tiene el h1 de
            debajo. Ver `ui/logotipo.tsx`. */}
        <Logotipo className="mx-auto h-7 w-auto text-foreground" />
        <h1 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-foreground">Dashboard interno</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Acceso solo con Google y por invitación. Si tu correo no está dado de
          alta, no podrás entrar.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm font-medium text-danger">
            {error === 'AccessDenied'
              ? 'Tu correo no está en la lista de invitados o está deshabilitado.'
              : 'No se pudo iniciar sesión. Inténtalo de nuevo.'}
          </p>
        )}

        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/app' })
          }}>
          <button
            type="submit"
            className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-foreground px-6 py-3 text-[15px] font-medium text-background transition-colors hover:bg-primary">
            <FaGoogle className="size-4" />
            Entrar con Google
          </button>
        </form>

        {devLogin && (
          // Solo en desarrollo con DEV_LOGIN_EMAIL: pasa por la misma allowlist y el mismo
          // registro de sesión que Google, solo se salta el OAuth.
          <form
            action={async () => {
              'use server'
              await signIn('dev', { redirectTo: '/app' })
            }}>
            <button
              type="submit"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-warning/60 bg-warning/10 px-6 py-2.5 text-sm font-medium text-warning transition-colors hover:bg-warning/15">
              <FlaskConical className="size-4" />
              Entrar como {devLogin}
              <span className="rounded-md bg-warning/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                dev
              </span>
            </button>
          </form>
        )}

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Sesión de una semana, verificada por Google
        </p>
      </div>

      <Link
        href="/"
        // py-2 solo suma zona táctil (el texto se ve igual): 20px de alto era
        // un objetivo escaso para el pulgar, y es el único control secundario.
        className="relative mt-5 flex items-center gap-1.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        Volver al portfolio
      </Link>
    </main>
  )
}
