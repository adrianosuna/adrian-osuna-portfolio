'use client'

// Gestión de usuarios (solo administradores): invitar por correo, cambiar rol,
// activar/deshabilitar y eliminar. Réplica del Users original. En escritorio
// es una tabla; en móvil, tarjetas apiladas (la tabla con scroll horizontal se
// veía mal). La fila del propio admin no muestra acciones: ninguna es legal
// sobre uno mismo (el servidor lo revalida igualmente).
import { useState, useTransition } from 'react'
import Image from 'next/image'
import {
  Ban, CircleCheck, Crown, Plus, Trash2, UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { SelectField, TextField } from '@/components/ui/fields'
import { inviteUser, removeUser, updateUser } from '@/app/app/panel/actions'

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

const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
const btnOutline =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary'
// p-2 (36px con icono): target táctil suficiente en móvil.
const btnIcon =
  'rounded-md p-2 max-sm:p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground'

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

function RolTag({ role }: { role: UserRow['role'] }) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-xs font-semibold',
        role === 'ADMIN' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
      )}>
      {role === 'ADMIN' ? 'Admin' : 'Usuario'}
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

  // Acciones sobre OTRO usuario (nunca se pintan para el propio admin).
  const acciones = (row: UserRow) => {
    const makeAdmin = row.role !== 'ADMIN'
    return (
      <span className="inline-flex items-center gap-0.5">
        <button
          type="button"
          className={btnIcon}
          disabled={pending}
          title={makeAdmin ? 'Hacer administrador' : 'Quitar administrador'}
          onClick={() =>
            run(
              updateUser(row.uuid, { role: makeAdmin ? 'ADMIN' : 'USER' }),
              makeAdmin ? 'Ahora es administrador' : 'Ya no es administrador',
            )
          }>
          {makeAdmin ? <Crown className="size-4" /> : <UserRound className="size-4" />}
        </button>

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
            title="Bloquear"
            onClick={() =>
              run(updateUser(row.uuid, { status: 'DISABLED' }), 'Usuario deshabilitado — su sesión queda cortada')
            }>
            <Ban className="size-4" />
          </button>
        )}

        {confirming === row.uuid ? (
          <>
            <button
              type="button"
              className="rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white max-sm:px-3 max-sm:py-2"
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
            title="Eliminar"
            onClick={() => setConfirming(row.uuid)}>
            <Trash2 className="size-4" />
          </button>
        )}
      </span>
    )
  }

  const thClass = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground'
  const tdClass = 'px-3 py-2.5'

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button type="button" className={btnPrimary} onClick={() => setModalOpen(true)}>
          <Plus className="size-4" /> Invitar
        </button>
      </div>

      {/* Móvil: tarjetas apiladas */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => {
          const isMe = row.uuid === meUuid
          const status = STATUS_TAG[row.status]
          return (
            <div key={row.uuid} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Avatar row={row} />
                <div className="min-w-0 flex-1 leading-tight">
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
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <RolTag role={row.role} />
                <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', status.className)}>
                  {status.label}
                </span>
                {row.lastLogin && (
                  <span className="text-[11.5px] text-muted-foreground/70">
                    Último acceso: {fmtDate(row.lastLogin)}
                  </span>
                )}
              </div>
              {!isMe && (
                <div className="mt-2.5 flex justify-end border-t border-border/60 pt-1.5">
                  {acciones(row)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <table className="w-full min-w-190 text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={thClass}>Usuario</th>
              <th className={cn(thClass, 'text-center')}>Rol</th>
              <th className={cn(thClass, 'text-center')}>Estado</th>
              <th className={thClass}>Último acceso</th>
              <th className={thClass}>Alta</th>
              <th className={cn(thClass, 'text-center')}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isMe = row.uuid === meUuid
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
                    <RolTag role={row.role} />
                  </td>
                  <td className={cn(tdClass, 'text-center')}>
                    <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', status.className)}>
                      {status.label}
                    </span>
                  </td>
                  <td className={cn(tdClass, 'whitespace-nowrap')}>
                    {fmtDate(row.lastLogin) ?? <span className="text-muted-foreground">Nunca</span>}
                  </td>
                  <td className={cn(tdClass, 'whitespace-nowrap')}>{fmtDate(row.createTs) ?? '—'}</td>
                  <td className={cn(tdClass, 'text-center')}>
                    {isMe ? <span className="text-xs text-muted-foreground/50">—</span> : acciones(row)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Invitar usuario */}
      {modalOpen && (
        <Modal
          title="Invitar usuario"
          description="El correo queda en la lista de invitados y podrá entrar con su cuenta de Google."
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button type="button" className={btnOutline} onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className={btnPrimary} disabled={!email.trim() || pending} onClick={onInvite}>
                Invitar
              </button>
            </>
          }>
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-[13px] text-muted-foreground">Correo de Google</p>
                <TextField
                  type="email"
                  value={email}
                  autoFocus
                  onChange={setEmail}
                  onEnter={() => email.trim() && onInvite()}
                />
              </div>
              <div>
                <p className="mb-1 text-[13px] text-muted-foreground">Rol</p>
                <SelectField
                  ariaLabel="Rol"
                  value={role}
                  onChange={(v) => setRole(v as 'ADMIN' | 'USER')}
                  options={[
                    { value: 'USER', label: 'Usuario' },
                    { value: 'ADMIN', label: 'Admin' },
                  ]}
                />
              </div>
            </div>
        </Modal>
      )}
    </div>
  )
}
