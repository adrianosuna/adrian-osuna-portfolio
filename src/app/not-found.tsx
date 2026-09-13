// Página 404 con el estilo de la landing (sustituye a la genérica de Next en inglés).
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    // `main`: mismo motivo que en el login.
    <main className="pf-public relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center text-body">
      <div aria-hidden="true" className="pf-grid absolute inset-0 mask-[radial-gradient(ellipse_60%_60%_at_50%_40%,#000_10%,transparent_75%)]" />
      <div aria-hidden="true" className="pf-hero-glow" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          Error 404
        </span>
        <h1 className="mt-6 text-[clamp(88px,16vw,160px)] font-semibold leading-none tracking-[-0.06em] text-foreground">
          404
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-body sm:text-lg">
          Esta página no existe o ha cambiado de sitio. Vuelve al inicio y sigue
          explorando desde allí.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-primary">
          <ArrowLeft className="size-4" />
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
