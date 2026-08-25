'use client'

// Barra superior del dashboard: navegación por módulos + perfil con cierre de
// sesión. Las entradas de administración solo aparecen para admins.
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, LogOut, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopNavProps {
  user: { name: string | null; email: string | null; image: string | null; role: 'ADMIN' | 'USER' }
  onSignOut: () => Promise<void>
}

export function TopNav({ user, onSignOut }: TopNavProps) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Finanzas y Usuarios son módulos del admin; los invitados solo ven Inicio.
  const links = [
    { href: '/app', label: 'Inicio' },
    ...(user.role === 'ADMIN'
      ? [
          { href: '/app/finance', label: 'Finanzas' },
          { href: '/app/system/users', label: 'Usuarios' },
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

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
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

        {/* Perfil */}
        <div className="relative" ref={profileRef}>
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
      </div>
    </header>
  )
}
