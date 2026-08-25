'use client'

// Barra de navegación de la landing: ancho completo, transparente sobre el
// hero y con fondo oscuro + blur + borde al hacer scroll (o al abrir el menú).
// En móvil, el menú se despliega como panel flotante bajo la barra.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Content } from '@/lib/landing/content'

function Logo() {
  return (
    // El punto salta y pasa a esmeralda al pasar el cursor (micro-detalle).
    <span className="group text-[22px] font-extrabold tracking-[-0.5px] text-foreground">
      AO
      <span className="inline-block text-accent-teal transition-all duration-300 group-hover:-translate-y-0.5 group-hover:scale-125 group-hover:text-primary motion-reduce:transition-none">
        .
      </span>
    </span>
  )
}

// Scroll-spy: devuelve el id de la sección visible en el centro de la pantalla.
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id)
        }
      },
      // Franja central de la pantalla: la sección "activa" es la que la cruza.
      { rootMargin: '-35% 0px -55% 0px' },
    )
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])

  return active
}

interface NavbarProps {
  t: Content
}

export function Navbar({ t }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const anchors = [
    { href: '#proyectos', label: t.nav.projects },
    { href: '#sobre-mi', label: t.nav.about },
    { href: '#experiencia', label: t.nav.experience },
    { href: '#contacto', label: t.nav.contact },
  ]
  const activeId = useActiveSection(['proyectos', 'sobre-mi', 'experiencia', 'contacto'])

  // Transparente arriba del todo; con fondo en cuanto hay scroll.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Mientras el menú móvil está abierto: bloquea el scroll del fondo y permite
  // cerrar con la tecla Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [menuOpen])

  return (
    <>
      {/* Overlay para cerrar el menú móvil tocando fuera */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/25 transition-opacity md:hidden',
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Con el menú móvil abierto, barra y panel van con fondo SÓLIDO (sin
          transparencia ni blur); con scroll, translúcida con blur. */}
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 border-b transition-colors duration-300',
          menuOpen
            ? 'border-border bg-background'
            : scrolled
              ? 'border-border bg-(--pf-nav) backdrop-blur-xl'
              : 'border-transparent bg-transparent',
        )}>
        <div className="relative mx-auto flex h-16 max-w-300 items-center justify-between px-4 sm:px-8">
          <a href="#contenido" aria-label={t.a11y.home}>
            <Logo />
          </a>

          {/* Enlaces (escritorio): centrados en la barra; el activo lleva su
              propia mini-píldora */}
          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 md:flex">
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                aria-current={activeId === a.href.slice(1) ? 'true' : undefined}
                className={cn(
                  'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[14px] font-medium transition-colors',
                  activeId === a.href.slice(1)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}>
                {a.label}
              </a>
            ))}
          </nav>

          <Link
            href="/app"
            className="hidden items-center rounded-full bg-btn px-4.5 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:bg-btn-hover md:inline-flex">
            {t.nav.dashboard}
          </Link>

          {/* Botón del menú móvil: alterna hamburguesa/X */}
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? t.a11y.closeMenu : t.a11y.openMenu}
            aria-expanded={menuOpen}
            aria-controls="menu-movil">
            {menuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
        </div>

        {/* Menú móvil: panel flotante desplegado bajo la barra. `inert` lo saca
            del orden de tabulación mientras está cerrado. */}
        <div
          id="menu-movil"
          className={cn(
            'absolute inset-x-3 top-[calc(100%+8px)] origin-top rounded-3xl border border-border bg-popover p-3 shadow-[0_18px_50px_var(--pf-shadow)] transition-all duration-200 motion-reduce:transition-none md:hidden',
            menuOpen
              ? 'pointer-events-auto scale-100 opacity-100'
              : 'pointer-events-none -translate-y-2 scale-95 opacity-0',
          )}
          aria-hidden={!menuOpen}
          inert={!menuOpen}>
          <nav className="flex flex-col gap-0.5">
            {anchors.map((a) => (
              <a
                key={a.href}
                href={a.href}
                aria-current={activeId === a.href.slice(1) ? 'true' : undefined}
                className={cn(
                  'rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors',
                  activeId === a.href.slice(1)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                onClick={() => setMenuOpen(false)}>
                {a.label}
              </a>
            ))}
          </nav>
          <div className="mt-2 border-t border-border pt-3">
            <Link
              href="/app"
              className="flex w-full items-center justify-center rounded-full bg-btn px-4.5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-btn-hover"
              onClick={() => setMenuOpen(false)}>
              {t.nav.dashboard}
            </Link>
          </div>
        </div>
      </header>
    </>
  )
}
