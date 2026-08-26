// Home del dashboard interno: saludo contextual, resumen, accesos rápidos,
// hoja de ruta y estado de la cuenta (réplica del Home original).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight, Briefcase, CalendarDays, Euro, ExternalLink, Gauge, LayoutGrid,
  Rocket, ShieldCheck, TrendingUp,
} from 'lucide-react'
import { FaGoogle } from 'react-icons/fa6'
import { auth } from '@/auth'
import { listYears, ahorroAnualDe } from '@/lib/finance'
import { cn } from '@/lib/utils'

// Euros sin decimales (mismo criterio que el módulo de finanzas).
const eur = (v: number) =>
  v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

// Saludo según la hora del día (hora española).
const saludo = () => {
  const h = Number(new Date().toLocaleString('es-ES', { hour: 'numeric', hour12: false, timeZone: 'Europe/Madrid' }))
  if (h < 7) return 'Buenas noches'
  if (h < 14) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

// Chip cuadrado con icono sobre fondo suave (cabeceras de tarjeta y stats).
function IconChip({ icon, className, size = 'md' }: { icon: React.ReactNode; className: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-[10px]',
        size === 'md' ? 'size-11' : 'size-8',
        className,
      )}>
      {icon}
    </span>
  )
}

export default async function HomePage() {
  // El layout ya redirige sin sesión, pero layout y página renderizan en
  // paralelo: la página debe protegerse por sí misma.
  const session = await auth()
  if (!session?.user) redirect('/login')
  const user = session.user
  const isAdmin = user.role === 'ADMIN'
  const firstName = (user.name ?? '').split(' ')[0] || 'de nuevo'
  const fechaRaw = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid',
  })
  const hoy = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1)

  // Ahorro general del año en curso (módulo de finanzas). Las finanzas son
  // personales del administrador: a otros roles ni se les consultan.
  const years = isAdmin ? await listYears() : []
  const actual = years.find((y) => y.year === new Date().getFullYear())
  const ahorro = actual ? ahorroAnualDe(actual) : null

  const stats = [
    ...(isAdmin
      ? [{
          title: `Ahorro en ${new Date().getFullYear()}`,
          value: ahorro === null ? '—' : eur(ahorro),
          icon: <Euro className="size-5" />, chip: 'bg-primary/10 text-primary',
          to: '/app/finance', hint: ahorro === null ? 'Sin datos' : 'Finanzas',
        }]
      : []),
    {
      title: 'Gastos del mes', value: '—',
      icon: <TrendingUp className="size-5" />, chip: 'bg-success-bg text-success', hint: 'En desarrollo',
    },
    {
      title: 'Módulos activos', value: '3',
      icon: <LayoutGrid className="size-5" />, chip: 'bg-viajes-bg text-viajes', hint: 'Finanzas, Pipeline y Panel de control',
    },
  ]

  const shortcuts = [
    ...(isAdmin
      ? [
          { title: 'Finanzas', desc: 'Sistema de ahorro anual y control de gastos.', icon: <Euro className="size-4.5" />, chip: 'bg-primary/10 text-primary', to: '/app/finance' },
          { title: 'Oportunidades', desc: 'Pipeline de ofertas y encargos, del contacto al cierre.', icon: <Briefcase className="size-4.5" />, chip: 'bg-warning-bg text-warning', to: '/app/pipeline' },
          { title: 'Panel de control', desc: 'Servidor, visitas y usuarios en un solo sitio.', icon: <Gauge className="size-4.5" />, chip: 'bg-success-bg text-success', to: '/app/panel' },
        ]
      : []),
    { title: 'Portfolio público', desc: 'Abre la landing tal y como la ven tus visitas.', icon: <ExternalLink className="size-4.5" />, chip: 'bg-primary/10 text-primary', to: '/' },
  ]

  const roadmap = [
    { title: 'Sistema de ahorro anual', desc: 'Control mensual, ingresos extra, viajes y KPIs por año.', tag: 'Disponible', tagClass: 'bg-success-bg text-success' },
    { title: 'Pipeline de oportunidades', desc: 'Kanban de ofertas y encargos por estados.', tag: 'Disponible', tagClass: 'bg-success-bg text-success' },
    { title: 'Gestión de usuarios', desc: 'Allowlist con roles, dentro del Panel de control.', tag: 'Disponible', tagClass: 'bg-success-bg text-success' },
    { title: 'Panel de control', desc: 'Monitor de infraestructura y estado en vivo del servidor.', tag: 'Disponible', tagClass: 'bg-success-bg text-success' },
    { title: 'Control de gastos', desc: 'Registro de movimientos, categorías y resumen mensual.', tag: 'En desarrollo', tagClass: 'bg-warning-bg text-warning' },
  ]

  const cuenta = [
    { label: 'Correo', value: user.email ?? '—' },
    { label: 'Acceso', value: <span className="inline-flex items-center gap-1.5"><FaGoogle className="size-3" />Cuenta de Google verificada</span> },
    { label: 'Sesión', value: 'Caduca automáticamente a la semana' },
    { label: 'Rol', value: isAdmin ? 'Administrador (gestión completa del panel)' : 'Usuario' },
  ]

  const cardClass = 'rounded-xl border border-border bg-card'

  return (
    <div>
      {/* Cabecera: saludo + fecha + rol */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            {saludo()}, {firstName}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            {hoy}
          </p>
        </div>
        <span
          className={cn(
            'mt-1.5 rounded-md px-2.5 py-1 text-xs font-semibold',
            isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}>
          {isAdmin ? 'Administrador' : 'Usuario'}
        </span>
      </div>

      {/* Resumen */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const body = (
            <div className={cn(cardClass, 'flex items-center gap-3.5 p-5', s.to && 'transition-all hover:-translate-y-0.5 hover:shadow-md')}>
              <IconChip icon={s.icon} className={s.chip} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] text-muted-foreground">{s.title}</p>
                <p className="text-2xl font-semibold">{s.value}</p>
              </div>
              {s.hint && (
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s.hint}</span>
              )}
            </div>
          )
          return s.to ? (
            <Link key={s.title} href={s.to}>{body}</Link>
          ) : (
            <div key={s.title}>{body}</div>
          )
        })}
      </div>

      {/* Accesos rápidos */}
      <h2 className="mb-3 mt-8 text-base font-semibold">Accesos rápidos</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((s) => (
          <Link key={s.title} href={s.to}>
            <div className={cn(cardClass, 'h-full p-5 transition-all hover:-translate-y-0.5 hover:shadow-md')}>
              <IconChip icon={s.icon} className={s.chip} size="sm" />
              <p className="mt-3.5 text-[15px] font-semibold">{s.title}</p>
              <p className="mt-1 min-h-9 text-[13px] text-muted-foreground">{s.desc}</p>
              <p className="mt-2.5 flex items-center gap-1 text-[13px] font-semibold text-primary">
                Abrir <ArrowRight className="size-3" />
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Hoja de ruta + estado de la cuenta */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[7fr_5fr]">
        <div className={cn(cardClass, 'px-5 py-4')}>
          <h2 className="flex items-center gap-2.5 border-b border-border pb-3 text-[15px] font-semibold">
            <IconChip icon={<Rocket className="size-4" />} className="bg-primary/10 text-primary" size="sm" />
            Hoja de ruta
          </h2>
          {roadmap.map((it, i) => (
            <div
              key={it.title}
              className={cn('flex items-center justify-between gap-3 py-3.5', i < roadmap.length - 1 && 'border-b border-border/60')}>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{it.title}</p>
                <p className="text-[12.5px] text-muted-foreground">{it.desc}</p>
              </div>
              <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold', it.tagClass)}>
                {it.tag}
              </span>
            </div>
          ))}
        </div>

        <div className={cn(cardClass, 'px-5 py-4')}>
          <h2 className="flex items-center gap-2.5 border-b border-border pb-3 text-[15px] font-semibold">
            <IconChip icon={<ShieldCheck className="size-4" />} className="bg-success-bg text-success" size="sm" />
            Tu cuenta
          </h2>
          {cuenta.map((it, i) => (
            <div key={it.label} className={cn('flex gap-3 py-3.5', i < cuenta.length - 1 && 'border-b border-border/60')}>
              <span className="w-16 shrink-0 pt-px text-[12.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground/70">
                {it.label}
              </span>
              <span className="min-w-0 wrap-break-word text-[13.5px]">{it.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
