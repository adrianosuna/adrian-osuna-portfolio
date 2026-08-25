// Autenticación con Google + allowlist en la tabla `user` (mismo modelo que el
// Portfolio original): solo entra un correo dado de alta. INVITED pasa a ACTIVE
// en su primer login; DISABLED (o no existente) se rechaza. Sesión JWT en
// cookie con caducidad de una semana (como la sesión Redis del original).
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
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
      return token
    },
    async session({ session, token }) {
      if (token.uuid) {
        session.user.uuid = token.uuid as string
        session.user.role = token.role as 'ADMIN' | 'USER'
      }
      return session
    },
  },
})

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
