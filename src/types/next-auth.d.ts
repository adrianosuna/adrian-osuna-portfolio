// Ampliación de los tipos de Auth.js con los campos propios del dashboard.
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    /** uuid de la fila de user_session de ESTA sesión (registro de sesiones). */
    sessionUuid?: string
    user: {
      uuid: string
      role: 'ADMIN' | 'USER'
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uuid?: string
    role?: 'ADMIN' | 'USER'
    sessionUuid?: string
  }
}
