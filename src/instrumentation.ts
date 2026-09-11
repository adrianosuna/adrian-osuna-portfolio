// Hook oficial de arranque de Next: se ejecuta una vez al levantar el servidor.
// Solo en el runtime Node (no en edge) y con import dinámico: el planificador
// arrastra node-cron, nodemailer y Prisma.
// ⚠ El registro de logs en BD NO se engancha aquí, y se intentó dos veces: el
// contexto de instrumentation está lo bastante aislado del de los route
// handlers como para que ni una variable de módulo ni `globalThis` lleguen al
// otro lado. Lo carga cada contexto por su cuenta; ver `persistir` en
// `lib/log.ts`.
//
// El try/catch es para que un fallo al importar el cron (los dos arrastran
// Prisma, y sin `DATABASE_URL` el import revienta) quede dicho por consola en
// vez de en silencio.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const { iniciarCron } = await import('@/lib/cron')
    iniciarCron()
  } catch (e) {
    const { log } = await import('@/lib/log')
    log.error('arranque', 'el cron no se pudo programar', { error: e })
  }
}
