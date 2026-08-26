// Hook oficial de arranque de Next: se ejecuta una vez al levantar el servidor.
// Solo en el runtime Node (no en edge) y con import dinámico: el planificador
// arrastra node-cron, nodemailer y Prisma.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { iniciarCron } = await import('@/lib/cron')
    iniciarCron()
  }
}
