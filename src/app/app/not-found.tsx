// 404 interno del dashboard: se muestra dentro del layout (barra de menú
// incluida) cuando una ruta bajo /app no existe.
import Link from 'next/link'
import { Compass, House, SearchX } from 'lucide-react'

export default function NotFoundApp() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <SearchX className="size-7" />
      </span>
      <h1 className="mt-5 text-2xl font-bold">Esta sección no existe</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        La ruta que has abierto no corresponde a ningún módulo del dashboard.
        Puede que el enlace sea antiguo o que la sección aún esté en construcción.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
          <House className="size-4" />
          Inicio del dashboard
        </Link>
        <Link
          href="/app/finance"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary">
          <Compass className="size-4" />
          Ir a Finanzas
        </Link>
      </div>
    </div>
  )
}
