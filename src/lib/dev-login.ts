// Atajo de login para DESARROLLO: entrar como un correo de la allowlist sin
// pasar por Google. Existe para no teclear el correo (ni abrir la cuenta de
// Google) cada vez que se arranca el dev server o se prueba algo con sesión.
//
// Dos candados, y los dos hacen falta:
//
//   1. `NODE_ENV !== 'production'`. El build de producción (Docker, `pnpm
//      build`) fija NODE_ENV=production, así que aunque la variable se colara
//      en el `.env` del VPS, aquí sale null y el proveedor NO se registra.
//   2. `DEV_LOGIN_EMAIL` puesta. Opt-in explícito, no "si hay ADMIN_EMAIL":
//      un atajo que salta la autenticación tiene que activarse a sabiendas.
//
// El correo sigue pasando por la MISMA allowlist y el mismo callback que
// Google (INVITED → ACTIVE, DISABLED rechazado, fila en `user_session`,
// `login_event`, caducidad): lo único que se ahorra es el OAuth. Así lo que se
// prueba con el atajo es lo mismo que verá el usuario real.
//
// Sin `server-only` a propósito: lo leen `auth.ts` (servidor) y los tests.

/** Correo del atajo, en minúsculas, o null si no está activo. */
export const correoDevLogin = (): string | null => {
  if (process.env.NODE_ENV === 'production') return null
  const v = process.env.DEV_LOGIN_EMAIL?.trim().toLowerCase()
  return v || null
}
