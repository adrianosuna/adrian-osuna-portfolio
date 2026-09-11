// Atajo de login de desarrollo: entra como DEV_LOGIN_EMAIL sin Google. Dos candados:
// NODE_ENV !== 'production' y la variable puesta. Misma allowlist y registro que Google.

/** Correo del atajo, en minúsculas, o null si no está activo. */
export const correoDevLogin = (): string | null => {
  if (process.env.NODE_ENV === 'production') return null
  const v = process.env.DEV_LOGIN_EMAIL?.trim().toLowerCase()
  return v || null
}
