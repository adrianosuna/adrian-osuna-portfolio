'use client'

// Histórico de accesos de la pestaña Usuarios: los últimos logins, con su
// dispositivo y su fecha.
//
// Es lo que `SessionsList` no puede contar: ahí solo están las sesiones VIVAS
// (se purgan a los 7 días y el logout retira la suya), así que un acceso raro
// de hace dos semanas no dejaba rastro. Estas filas no se borran nunca
// (`login_event` es append-only), y por eso aquí sí se muestra la fecha
// absoluta: en un registro de accesos, "hace 12 días" no sirve para comprobar
// nada — la hora exacta sí.
import { History, UserRound } from 'lucide-react'
import Image from 'next/image'
import { Celda, Fila, FilaVacia, Tabla, TarjetaTabla, type Columna } from '@/components/ui/tabla'

export interface AccesoRow {
  uuid: string
  userName: string | null
  userEmail: string
  userPicture: string | null
  /** "Chrome · Windows" (user-agent resumido). */
  dispositivo: string
  /** Momento del login, ISO. */
  ts: string
}

/** 'dd/mm/yyyy hh:mm' en horario de Madrid (el del resto del panel). */
const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })

const COLUMNAS: Columna[] = [
  { label: 'Usuario' },
  { label: 'Dispositivo' },
  { label: 'Fecha', alineado: 'derecha' },
]

export function AccesosList({ rows, total }: { rows: AccesoRow[]; total: number }) {
  return (
    <TarjetaTabla
      titulo="Histórico de accesos"
      icono={<History className="size-4 text-primary" />}
      // La cifra dice CUÁNTOS se ven de cuántos hay: la lista está recortada a
      // los últimos, y sin decirlo parecería que solo ha habido esos.
      acciones={
        <p className="text-[12.5px] text-muted-foreground">
          {total === 0
            ? 'sin registros'
            : `${rows.length} de ${total} ${total === 1 ? 'acceso' : 'accesos'}`}
        </p>
      }>
      <Tabla columnas={COLUMNAS} minAncho="min-w-140">
        {rows.length === 0 ? (
          <FilaVacia columnas={COLUMNAS.length}>
            Todavía no hay accesos registrados. Cada inicio de sesión se apuntará aquí, aunque
            después se cierre.
          </FilaVacia>
        ) : (
          rows.map((a) => (
            <Fila key={a.uuid}>
              <Celda>
                <span className="flex items-center gap-2">
                  {a.userPicture ? (
                    <Image
                      src={a.userPicture}
                      alt=""
                      width={24}
                      height={24}
                      className="shrink-0 rounded-full"
                    />
                  ) : (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserRound className="size-3.5" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {a.userName ?? a.userEmail}
                    </span>
                    {a.userName && (
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {a.userEmail}
                      </span>
                    )}
                  </span>
                </span>
              </Celda>
              <Celda className="text-muted-foreground">{a.dispositivo}</Celda>
              <Celda alineado="derecha" className="tabular-nums text-muted-foreground">
                {fmt(a.ts)}
              </Celda>
            </Fila>
          ))
        )}
      </Tabla>
    </TarjetaTabla>
  )
}
