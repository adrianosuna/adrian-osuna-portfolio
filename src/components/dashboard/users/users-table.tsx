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
import { useConfirmar } from '@/components/dashboard/confirmar'
import { Modal } from '@/components/ui/modal'
import { SelectField, TextField } from '@/components/ui/fields'
import { inviteUser, removeUser, updateUser } from '@/app/app/panel/actions'
import { btnOutline, btnPrimary } from '@/components/ui/botones'
import { MenuAcciones } from '@/components/dashboard/menu-acciones'
import { tdClass, thClass } from '@/components/ui/tabla'

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
  const confirmar = useConfirmar()
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
  //
  // Declaradas, no maquetadas: `MenuAcciones` las pinta como iconos en
  // escritorio y como menú de tres puntos en móvil. De paso cada una gana un
  // NOMBRE de verdad — antes solo tenían `title`, que un lector de pantalla
  // usa como último recurso y un móvil no enseña nunca.
  const acciones = (row: UserRow) => {
    const makeAdmin = row.role !== 'ADMIN'
    const bloqueado = row.status === 'DISABLED'
    return (
      <MenuAcciones
        etiqueta={row.name ?? row.email}
        acciones={[
          {
            id: 'rol',
            label: makeAdmin ? 'Hacer administrador' : 'Quitar administrador',
            icon: makeAdmin ? <Crown className="size-4" /> : <UserRound className="size-4" />,
            disabled: pending,
            onClick: () =>
              run(
                updateUser(row.uuid, { role: makeAdmin ? 'ADMIN' : 'USER' }),
                makeAdmin ? 'Ahora es administrador' : 'Ya no es administrador',
              ),
          },
          bloqueado
            ? {
                id: 'activar',
                label: 'Activar',
                icon: <CircleCheck className="size-4" />,
                disabled: pending,
                onClick: () =>
                  run(updateUser(row.uuid, { status: 'ACTIVE' }), 'Usuario activado'),
              }
            : {
                id: 'bloquear',
                label: 'Bloquear',
                icon: <Ban className="size-4" />,
                destructiva: true,
                disabled: pending,
                onClick: () =>
                  run(
                    updateUser(row.uuid, { status: 'DISABLED' }),
                    'Usuario deshabilitado — su sesión queda cortada',
                  ),
              },
          {
            id: 'eliminar',
            label: 'Eliminar',
            icon: <Trash2 className="size-4" />,
            destructiva: true,
            disabled: pending,
            onClick: async () => {
              // Sin `clave`: borrar un usuario retira su acceso y sus sesiones,
              // y no hay marcha atrás. Esto se pregunta siempre.
              if (
                await confirmar({
                  titulo: 'Eliminar el usuario',
                  texto: `Se eliminará ${row.email} y se cerrarán sus sesiones. No se puede deshacer.`,
                })
              ) {
                run(removeUser(row.uuid), 'Usuario eliminado')
              }
            },
          },
        ]}
      />
    )
  }

  // Clases de la tabla: las comunes de `ui/tabla` (antes aquí eran `py-2.5`,
  // media línea más altas que las del Ahorro sin ningún motivo).

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
                  <span className="text-[11.5px] text-muted-foreground">
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
                    {isMe ? <span className="text-xs text-muted-foreground">—</span> : acciones(row)}
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
