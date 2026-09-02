'use client'

// Barra superior del dashboard: navegación por módulos + perfil con cierre de
// sesión. Las entradas de administración solo aparecen para admins. En móvil
// los enlaces van en un panel desplegable sólido (hamburguesa), como el menú
// de la landing: la fila horizontal con scroll no daba la talla con 5 módulos.
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, Keyboard, LogOut, Menu, Plus, RotateCcw, Search, UserRound, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAcciones } from '@/components/dashboard/acciones-rapidas'
import { useSilenciadas } from '@/components/dashboard/confirmar'
import { Notificaciones } from '@/components/dashboard/notificaciones'
import { TogglePush } from '@/components/dashboard/push'
import type { Aviso } from '@/lib/inicio'

interface TopNavProps {
  user: { name: string | null; email: string | null; image: string | null; role: 'ADMIN' | 'USER' }
  /** Avisos accionables para la campana (los calcula el layout). */
  avisos: Aviso[]
  onSignOut: () => Promise<void>
}

export function TopNav({ user, avisos, onSignOut }: TopNavProps) {
  const pathname = usePathname()
  const acc = useAcciones()
  const [silenciadas, restablecer] = useSilenciadas()
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
    // safe-top: en apaisado y en la isla dinámica el recorte llega hasta aquí.
    <header className="safe-top sticky top-0 z-40 border-b border-border bg-background">
      <div className="safe-x mx-auto flex h-14 w-full max-w-300 items-center gap-4">
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

        {/* Campana de avisos: en las dos anchuras (es la señal, no un extra) */}
        {acc.isAdmin && <Notificaciones avisos={avisos} />}

        {/* Acciones rápidas en escritorio: paleta ⌘K y alta de movimiento */}
        {acc.isAdmin && (
          <div className="hidden items-center gap-1.5 md:flex">
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              onClick={acc.abrirPaleta}>
              <Search className="size-4" />
              <span>Buscar</span>
              <kbd className="rounded border border-border px-1 text-[11px] leading-relaxed">Ctrl&nbsp;K</kbd>
            </button>
            <button
              type="button"
              className="flex items-center justify-center rounded-md bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-90"
              aria-label="Nuevo movimiento"
              title="Nuevo movimiento"
              onClick={() => acc.abrirAlta('GASTO')}>
              <Plus className="size-4" />
            </button>
          </div>
        )}

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
              {/* Preferencias de ESTE navegador (no viajan a la BD) */}
              <div className="mt-1 border-b border-border pb-1">
                <TogglePush />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    setProfileOpen(false)
                    acc.abrirAtajos()
                  }}>
                  <Keyboard className="size-4" />
                  Atajos de teclado
                </button>
                {/* Solo si hay algo silenciado: un botón que no hace nada es ruido. */}
                {silenciadas.length > 0 && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      restablecer()
                      setProfileOpen(false)
                    }}>
                    <RotateCcw className="size-4" />
                    Volver a preguntar al eliminar
                    <span className="ml-auto rounded-full bg-muted px-1.5 text-[11px] tabular-nums">
                      {silenciadas.length}
                    </span>
                  </button>
                )}
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

        {/* Acciones rápidas en móvil: buscar (paleta) y alta de movimiento */}
        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          aria-label="Buscar"
          onClick={acc.abrirPaleta}>
          <Search className="size-5" />
        </button>
        {acc.isAdmin && (
          <button
            type="button"
            className="rounded-md bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-90 md:hidden"
            aria-label="Nuevo movimiento"
            onClick={() => acc.abrirAlta('GASTO')}>
            <Plus className="size-5" />
          </button>
        )}

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
        <nav className="safe-x safe-bottom border-t border-border bg-popover py-3 shadow-lg md:hidden">
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
