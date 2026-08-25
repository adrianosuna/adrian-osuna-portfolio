'use client'

// Tabla de gestión de usuarios (solo administradores): invitar por correo,
// cambiar rol, activar/deshabilitar y eliminar. Réplica del Users original.
import { useState, useTransition } from 'react'
import Image from 'next/image'
import {
  Ban, CircleCheck, Crown, Plus, Trash2, UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { inviteUser, removeUser, updateUser } from '@/app/app/system/users/actions'

export interface UserRow {
  uuid: string
  email: string
  name: string | null
  picture: string | null
  role: 'ADMIN' | 'USER'
  status: 'INVITED' | 'ACTIVE' | 'DISABLED'
  lastLogin: string | null // ISO
  createTs: string // ISO
}

const STATUS_TAG: Record<UserRow['status'], { className: string; label: string }> = {
  INVITED: { className: 'bg-warning-bg text-warning', label: 'Invitado' },
  ACTIVE: { className: 'bg-success-bg text-success', label: 'Activo' },
  DISABLED: { className: 'bg-danger-bg text-danger', label: 'Deshabilitado' },
}

const fmtDate = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`
}

// text-base en móvil: con menos de 16px, iOS Safari hace zoom al enfocar un input.
const inputClass =
  'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-base outline-none transition-colors focus:border-primary sm:text-sm'
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
const btnOutline =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary'
// p-2 (36px con icono): target táctil suficiente en móvil.
const btnIcon =
  'rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground'

function Avatar({ row }: { row: UserRow }) {
  if (row.picture) {
    return <Image src={row.picture} alt="" width={36} height={36} className="rounded-full" />
  }
  return (
    <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
      <UserRound className="size-4.5" />
    </span>
  )
}

export function UsersTable({ rows, meUuid }: { rows: UserRow[]; meUuid: string }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (promise: Promise<{ ok: boolean; message?: string }>, success: string) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) toast.error(res.message ?? 'Error')
      else toast.success(success)
    })

  const onInvite = () =>
    startTransition(async () => {
      const res = await inviteUser({ email, role })
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(`${email.trim().toLowerCase()} invitado — ya puede entrar con Google`)
      setModalOpen(false)
      setEmail('')
      setRole('USER')
    })

  const thClass = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground'
  const tdClass = 'px-3 py-2.5'

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button type="button" className={btnPrimary} onClick={() => setModalOpen(true)}>
          <Plus className="size-4" /> Invitar
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {/* En móvil se ocultan las columnas informativas de fechas: así las
            acciones quedan a mano sin arrastrar 400px de scroll. */}
        <table className="w-full min-w-120 text-sm md:min-w-190">
          <thead>
            <tr className="border-b border-border">
              <th className={thClass}>Usuario</th>
              <th className={cn(thClass, 'text-center')}>Rol</th>
              <th className={cn(thClass, 'text-center')}>Estado</th>
              <th className={cn(thClass, 'hidden md:table-cell')}>Último acceso</th>
              <th className={cn(thClass, 'hidden md:table-cell')}>Alta</th>
              <th className={cn(thClass, 'text-center')}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isMe = row.uuid === meUuid
              const makeAdmin = row.role !== 'ADMIN'
              const status = STATUS_TAG[row.status]
              return (
                <tr key={row.uuid} className="border-b border-border/50 last:border-0">
                  <td className={tdClass}>
                    <div className="flex items-center gap-3">
                      <Avatar row={row} />
                      <div className="min-w-0 leading-tight">
                        <p className="truncate font-semibold">
                          {row.name || '—'}
                          {isMe && (
                            <span className="ml-1.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                              Tú
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className={cn(tdClass, 'text-center')}>
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-semibold',
                        row.role === 'ADMIN' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                      )}>
                      {row.role === 'ADMIN' ? 'Admin' : 'Usuario'}
                    </span>
                  </td>
                  <td className={cn(tdClass, 'text-center')}>
                    <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', status.className)}>
                      {status.label}
                    </span>
                  </td>
                  <td className={cn(tdClass, 'hidden whitespace-nowrap md:table-cell')}>
                    {fmtDate(row.lastLogin) ?? <span className="text-muted-foreground">Nunca</span>}
                  </td>
                  <td className={cn(tdClass, 'hidden whitespace-nowrap md:table-cell')}>{fmtDate(row.createTs) ?? '—'}</td>
                  <td className={cn(tdClass, 'text-center')}>
                    <span className="inline-flex items-center gap-0.5">
                      {/* Hacer/quitar administrador. Las autoprotecciones avisan
                          con un toast al pulsar: el `title` solo se ve con ratón
                          y en táctil el porqué quedaría invisible. */}
                      <button
                        type="button"
                        className={btnIcon}
                        disabled={pending}
                        title={isMe ? 'No puedes cambiar tu rol' : makeAdmin ? 'Hacer administrador' : 'Quitar administrador'}
                        onClick={() => {
                          if (isMe) return void toast.error('No puedes cambiar tu propio rol')
                          run(
                            updateUser(row.uuid, { role: makeAdmin ? 'ADMIN' : 'USER' }),
                            makeAdmin ? 'Ahora es administrador' : 'Ya no es administrador',
                          )
                        }}>
                        {makeAdmin ? <Crown className="size-4" /> : <UserRound className="size-4" />}
                      </button>

                      {/* Activar / bloquear */}
                      {row.status === 'DISABLED' ? (
                        <button
                          type="button"
                          className={cn(btnIcon, 'text-success hover:bg-success-bg hover:text-success')}
                          disabled={pending}
                          title="Activar"
                          onClick={() => run(updateUser(row.uuid, { status: 'ACTIVE' }), 'Usuario activado')}>
                          <CircleCheck className="size-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={cn(btnIcon, 'hover:bg-danger-bg hover:text-danger')}
                          disabled={pending}
                          title={isMe ? 'No puedes bloquearte' : 'Bloquear'}
                          onClick={() => {
                            if (isMe) return void toast.error('No puedes bloquearte a ti mismo')
                            run(updateUser(row.uuid, { status: 'DISABLED' }), 'Usuario deshabilitado — su sesión queda cortada')
                          }}>
                          <Ban className="size-4" />
                        </button>
                      )}

                      {/* Eliminar (con confirmación inline) */}
                      {confirming === row.uuid ? (
                        <>
                          <button
                            type="button"
                            className="rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white"
                            onClick={() => {
                              setConfirming(null)
                              run(removeUser(row.uuid), 'Usuario eliminado')
                            }}>
                            Sí
                          </button>
                          <button type="button" className={btnIcon} onClick={() => setConfirming(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={cn(btnIcon, 'hover:bg-danger-bg hover:text-danger')}
                          disabled={pending}
                          title={isMe ? 'No puedes eliminarte' : 'Eliminar'}
                          onClick={() => {
                            if (isMe) return void toast.error('No puedes eliminarte a ti mismo')
                            setConfirming(row.uuid)
                          }}>
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Invitar usuario */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Invitar usuario" className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-popover p-5 shadow-xl">
            <h3 className="mb-1 text-base font-bold">Invitar usuario</h3>
            <p className="mb-4 text-[13px] text-muted-foreground">
              El correo queda en la lista de invitados y podrá entrar con su cuenta de Google.
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-[13px] text-muted-foreground">Correo de Google</p>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="persona@gmail.com"
                  value={email}
                  autoFocus
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && email.trim() && onInvite()}
                />
              </div>
              <div>
                <p className="mb-1 text-[13px] text-muted-foreground">Rol</p>
                <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'USER')}>
                  <option value="USER">Usuario</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={btnOutline} onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className={btnPrimary} disabled={!email.trim() || pending} onClick={onInvite}>
                Invitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
