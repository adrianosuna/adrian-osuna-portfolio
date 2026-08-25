// Acceso al dashboard: solo con Google y por lista de invitados (allowlist).
// Usa la paleta pública (esmeralda/teal), como el login del Portfolio original.
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { FaGoogle } from 'react-icons/fa6'
import { auth, signIn } from '@/auth'

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

  return (
    <div className="pf-public flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-body">
      <div className="w-full max-w-sm rounded-[18px] border border-border bg-card p-8 text-center shadow-[0_10px_40px_var(--pf-shadow)]">
        <span className="text-[26px] font-extrabold tracking-[-0.5px] text-foreground">
          AO<span className="text-accent-teal">.</span>
        </span>
        <h1 className="mt-4 text-xl font-bold text-foreground">Dashboard interno</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Acceso solo con Google y por invitación. Si tu correo no está dado de
          alta, no podrás entrar.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger">
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
            className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-btn px-6 py-3 text-[15px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-btn-hover">
            <FaGoogle className="size-4" />
            Entrar con Google
          </button>
        </form>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Sesión de una semana, verificada por Google
        </p>
      </div>

      <Link
        href="/"
        className="mt-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
        <ArrowLeft className="size-4" />
        Volver al portfolio
      </Link>
    </div>
  )
}
