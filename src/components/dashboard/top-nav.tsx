'use client'

// Barra superior del dashboard: navegación por módulos + perfil con cierre de
// sesión. Las entradas de administración solo aparecen para admins. En móvil
// los enlaces van en un panel desplegable sólido (hamburguesa), como el menú
// de la landing: la fila horizontal con scroll no daba la talla con 5 módulos.
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, LogOut, Menu, UserRound, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopNavProps {
  user: { name: string | null; email: string | null; image: string | null; role: 'ADMIN' | 'USER' }
  onSignOut: () => Promise<void>
}

export function TopNav({ user, onSignOut }: TopNavProps) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // El menú móvil se cierra al navegar (patrón valor-previo en render).
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setMenuOpen(false)
    setProfileOpen(false)
  }

  // Los módulos son del admin; los invitados solo ven Inicio.
  const links = [
    { href: '/app', label: 'Inicio' },
    ...(user.role === 'ADMIN'
      ? [
          { href: '/app/finance', label: 'Finanzas' },
          { href: '/app/pipeline', label: 'Oportunidades' },
          { href: '/app/panel', label: 'Panel de control' },
        ]
      : []),
  ]

  // Cierra el menú de perfil al hacer clic fuera.
  useEffect(() => {
    if (!profileOpen) return
    const onClick = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [profileOpen])

  const isActive = (href: string) => (href === '/app' ? pathname === '/app' : pathname.startsWith(href))

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 w-full max-w-300 items-center gap-4 px-4 sm:px-6">
        <Link href="/app" className="text-lg font-extrabold tracking-tight text-foreground">
          AO<span className="text-primary">.</span>
        </Link>

        {/* Enlaces inline solo en escritorio; en móvil van al panel desplegable */}
        <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive(l.href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}>
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="flex-1 md:hidden" />

        {/* Perfil (solo escritorio; en móvil va dentro del panel desplegable) */}
        <div className="relative hidden md:block" ref={profileRef}>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-border p-0.5 pr-2 transition-colors hover:border-primary/50"
            onClick={() => setProfileOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}>
            {user.image ? (
              <Image src={user.image} alt="" width={28} height={28} className="rounded-full" />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="size-4" />
              </span>
            )}
            <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
              {(user.name ?? user.email ?? '').split(' ')[0]}
            </span>
          </button>

          {profileOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-popover p-2 shadow-lg">
              <div className="border-b border-border px-3 pb-3 pt-1">
                <p className="truncate text-sm font-semibold">{user.name ?? '—'}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <span
                  className={cn(
                    'mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    user.role === 'ADMIN' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}>
                  {user.role === 'ADMIN' ? 'Administrador' : 'Usuario'}
                </span>
              </div>
              <Link
                href="/"
                className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setProfileOpen(false)}>
                <ExternalLink className="size-4" />
                Ver portfolio público
              </Link>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger transition-colors hover:bg-danger-bg"
                onClick={() => onSignOut()}>
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>

        {/* Hamburguesa (solo móvil) */}
        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}>
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Panel móvil: sólido (bg-popover), con los módulos y el perfil dentro */}
      {menuOpen && (
        <nav className="border-t border-border bg-popover px-4 py-3 shadow-lg md:hidden">
          <div className="mx-auto flex w-full max-w-300 flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'rounded-lg px-3.5 py-2.5 text-[15px] font-medium transition-colors',
                  isActive(l.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}>
                {l.label}
              </Link>
            ))}

            {/* Cuenta: datos + acciones de sesión */}
            <div className="mt-2 border-t border-border pt-3">
              <div className="flex items-center gap-3 px-3.5 pb-2">
                {user.image ? (
                  <Image src={user.image} alt="" width={36} height={36} className="rounded-full" />
                ) : (
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="size-4.5" />
                  </span>
                )}
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-semibold">
                    {user.name ?? '—'}
                    <span
                      className={cn(
                        'ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
                        user.role === 'ADMIN' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                      )}>
                      {user.role === 'ADMIN' ? 'Admin' : 'Usuario'}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[15px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <ExternalLink className="size-4" />
                Ver portfolio público
              </Link>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[15px] text-danger transition-colors hover:bg-danger-bg"
                onClick={() => onSignOut()}>
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
