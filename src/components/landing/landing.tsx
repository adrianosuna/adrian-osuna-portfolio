// Raíz de la landing pública: compone la barra de navegación y las secciones.
// Server component: sin estado propio, el HTML inicial llega completo.
import { Analytics } from '@/components/landing/analytics'
import { Navbar } from '@/components/landing/navbar'
import { BackToTop } from '@/components/landing/back-to-top'
import {
  About, Contact, Experience, Footer, Hero, Projects, Stats,
} from '@/components/landing/sections'
import { CONTENT } from '@/lib/landing/content'

export function Landing() {
  const t = CONTENT

  return (
    // .pf-public activa la paleta esmeralda/teal de las páginas públicas.
    // min-h-dvh (no screen/100vh): con las barras dinámicas del navegador
    // móvil, 100vh es más alto que el viewport visible.
    <div className="pf-public flex min-h-dvh flex-col bg-background text-body">
      {/* Skip-link: primer elemento tabulable; visible solo al recibir foco. */}
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        href="#contenido">
        {t.a11y.skip}
      </a>

      <Navbar t={t} />

      {/* Orden: la evidencia (proyectos) por delante de la biografía. */}
      <main id="contenido" className="flex-1">
        <Hero t={t} />
        <Stats t={t} />
        <Projects t={t} />
        <About t={t} />
        <Experience t={t} />
        <Contact t={t} />
      </main>

      <Footer t={t} />
      <BackToTop />
      <Analytics />
    </div>
  )
}
