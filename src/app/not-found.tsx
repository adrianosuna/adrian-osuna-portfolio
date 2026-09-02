// Página 404 con la paleta pública (sustituye a la genérica de Next en inglés).
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    // `main`: mismo motivo que en el login.
    <main className="pf-public flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center text-body">
      <p className="font-mono text-sm uppercase tracking-[2px] text-accent-teal">Error 404</p>
      <h1 className="mt-3 text-[clamp(72px,14vw,140px)] font-extrabold leading-none tracking-[-4px] text-foreground">
        404
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
        Esta página no existe o ha cambiado de sitio. Vuelve al inicio y sigue
        explorando desde allí.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-btn px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:bg-btn-hover">
        <ArrowLeft className="size-4" />
        Volver al inicio
      </Link>
    </main>
  )
}
