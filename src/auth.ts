// Autenticación con Google + allowlist en `user`. Sesión JWT con dos plazos
// (`lib/sesion-caducidad.ts`) y fila en `user_session` comprobada por petición.
import NextAuth, { type NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { headers } from 'next/headers'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { log } from '@/lib/log'
import { inactivaDemasiado, SEGUNDOS_SESION } from '@/lib/sesion-caducidad'
import { correoDevLogin } from '@/lib/dev-login'

/** Proveedor del atajo de desarrollo (`lib/dev-login.ts`): entra como DEV_LOGIN_EMAIL
 *  sin Google. En producción el array queda vacío y el proveedor ni existe. */
const proveedorDev = () => {
  const email = correoDevLogin()
  if (!email) return []
  return [
    Credentials({
      id: 'dev',
      name: 'Desarrollo',
      credentials: {},
      async authorize() {
        // Se relee por si la variable cambió desde el arranque; y NUNCA en
        // producción, aunque el proveedor se hubiera registrado por error.
        const correo = correoDevLogin()
        if (!correo) return null
        const u = await prisma.user.findUnique({ where: { email: correo } })
        if (!u || u.status === 'DISABLED') return null
        return { id: u.uuid, email: u.email, name: u.name, image: u.picture }
      },
    }),
  ]
}

// Config exportada aparte de NextAuth(): los tests unitarios invocan los
// callbacks (signIn/jwt/session) y eventos directamente con mocks de Prisma.
export const authConfig = {
  providers: [Google, ...proveedorDev()],
  session: { strategy: 'jwt', maxAge: SEGUNDOS_SESION },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user, profile, account }) {
      if (!user.email) return false
      // Google puede emitir tokens de cuentas con correo externo sin verificar:
      // la allowlist solo cuenta si el correo está verificado de verdad.
      if (profile && profile.email_verified !== true) return false
      // Normalizado a minúsculas, como hace inviteUser al dar de alta.
      const email = user.email.toLowerCase()
      // El atajo de desarrollo solo puede entrar como SU correo, y solo si
      // sigue activo: con la variable quitada (o en producción) no pasa.
      if (account?.provider === 'dev' && email !== correoDevLogin()) return false
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
      // Se reverifica el usuario en BD en cada petición: deshabilitar o eliminar corta la
      // sesión al instante y los cambios de rol aplican en vivo.
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
          const userAgent = ua ? ua.slice(0, 255) : null
          const [sesion] = await Promise.all([
            prisma.userSession.create({ data: { userUuid: registro.uuid, userAgent } }),
            // Histórico de accesos: `user_session` solo guarda lo vivo, así que "desde dónde
            // entré" vive aparte.
            prisma.loginEvent.create({
              data: { userUuid: registro.uuid, userEmail: email, userAgent },
            }),
          ])
          token.sessionUuid = sesion.uuid
        } catch (e) {
          log.error('auth', 'no se pudo registrar la sesión', { error: e })
        }
        return token
      }

      // La fila debe seguir existiendo: borrarla desde el panel cierra la sesión. Tokens
      // antiguos sin registro se invalidan (un relogin único).
      if (!token.sessionUuid) return null
      const sesion = await prisma.userSession.findUnique({
        where: { uuid: token.sessionUuid as string },
      })
      if (!sesion) return null

      // Plazo de inactividad: se borra la fila, no solo se rechaza el token, o seguiría
      // figurando como activa en el Panel.
      if (inactivaDemasiado(sesion.lastSeen)) {
        await prisma.userSession
          .delete({ where: { uuid: sesion.uuid } })
          .catch(() => {}) // ya la pudo borrar otra petición en paralelo
        return null
      }

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
          log.error('auth', 'no se pudo retirar la sesión al salir', { error: e })
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
