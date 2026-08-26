// Autenticación con Google + allowlist en la tabla `user` (mismo modelo que el
// Portfolio original): solo entra un correo dado de alta. INVITED pasa a ACTIVE
// en su primer login; DISABLED (o no existente) se rechaza. Sesión JWT en
// cookie con caducidad de una semana (como la sesión Redis del original).
// Cada login registra además una fila en `user_session`: el callback jwt la
// comprueba en cada petición, así el panel puede listar las sesiones activas
// y cerrarlas remotamente (borrar la fila mata esa sesión al instante).
import NextAuth, { type NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import { headers } from 'next/headers'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

// Config exportada aparte de NextAuth(): los tests unitarios invocan los
// callbacks (signIn/jwt/session) y eventos directamente con mocks de Prisma.
export const authConfig = {
  providers: [Google],
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email) return false
      // Google puede emitir tokens de cuentas con correo externo sin verificar:
      // la allowlist solo cuenta si el correo está verificado de verdad.
      if (profile && profile.email_verified !== true) return false
      // Normalizado a minúsculas, como hace inviteUser al dar de alta.
      const email = user.email.toLowerCase()
      const registro = await prisma.user.findUnique({ where: { email } })
      if (!registro || registro.status === 'DISABLED') return false
      await prisma.user.update({
        where: { email },
        data: {
          status: 'ACTIVE',
          name: user.name ?? registro.name,
          picture: user.image ?? registro.picture,
          googleSub: (profile?.sub as string | undefined) ?? registro.googleSub,
          lastLogin: new Date(),
        },
      })
      return true
    },
    async jwt({ token, user }) {
      // Se reverifica el usuario en BD en cada petición: así deshabilitar o
      // eliminar a alguien corta su sesión al instante (equivalente al purgado
      // de sesiones Redis del Portfolio original) y los cambios de rol se
      // aplican en vivo sin esperar a que caduque el JWT.
      const email = (user?.email ?? token.email)?.toLowerCase()
      if (!email) return null
      const registro = await prisma.user.findUnique({ where: { email } })
      if (!registro || registro.status === 'DISABLED') return null
      token.uuid = registro.uuid
      token.role = registro.role

      if (user) {
        // Primer paso del login: se registra la sesión. Si el alta fallara,
        // el login sigue adelante (el registro es control, no seguridad).
        try {
          const ua = (await headers()).get('user-agent')
          const sesion = await prisma.userSession.create({
            data: { userUuid: registro.uuid, userAgent: ua ? ua.slice(0, 255) : null },
          })
          token.sessionUuid = sesion.uuid
        } catch (e) {
          console.error('[auth] no se pudo registrar la sesión:', e)
        }
        return token
      }

      // Peticiones posteriores: la fila debe seguir existiendo — borrarla desde
      // el panel cierra la sesión aquí. Tokens antiguos sin registro (emitidos
      // antes de esta función) se invalidan: fuerza un relogin único y deja el
      // inventario de sesiones completo.
      if (!token.sessionUuid) return null
      const sesion = await prisma.userSession.findUnique({
        where: { uuid: token.sessionUuid as string },
      })
      if (!sesion) return null
      // Última actividad, con freno de 5 min para no escribir en cada petición.
      if (Date.now() - sesion.lastSeen.getTime() > 5 * 60_000) {
        await prisma.userSession.update({
          where: { uuid: sesion.uuid },
          data: { lastSeen: new Date() },
        })
      }
      return token
    },
    async session({ session, token }) {
      if (token.uuid) {
        session.user.uuid = token.uuid as string
        session.user.role = token.role as 'ADMIN' | 'USER'
      }
      if (token.sessionUuid) session.sessionUuid = token.sessionUuid as string
      return session
    },
  },
  events: {
    // Logout voluntario: se retira la fila para que no figure como activa.
    async signOut(message) {
      const sessionUuid = 'token' in message ? message.token?.sessionUuid : undefined
      if (sessionUuid) {
        await prisma.userSession.deleteMany({ where: { uuid: sessionUuid } }).catch((e) => {
          console.error('[auth] no se pudo retirar la sesión al salir:', e)
        })
      }
    },
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

// Guardas de sesión para páginas y server actions del dashboard.
export async function requireSession() {
  const session = await auth()
  if (!session?.user) throw new AppError('No autenticado')
  return session
}

export async function requireAdmin() {
  const session = await requireSession()
  if (session.user.role !== 'ADMIN') throw new AppError('Solo administradores')
  return session
}
