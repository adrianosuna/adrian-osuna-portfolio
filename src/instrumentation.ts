// Arranque de Next (una vez por proceso, solo runtime Node): programa el cron con
// import dinámico y try/catch. El registro en BD no se engancha aquí: ver `lib/log.ts`.
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
