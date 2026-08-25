// Error "de aplicación": lanzado a propósito con un mensaje pensado para el
// usuario (guardas de sesión, validaciones). Los catch de las server actions
// solo muestran el mensaje si el error es de esta clase; cualquier otra
// excepción (Prisma, red...) se registra en servidor y al cliente le llega un
// "Error inesperado" genérico, sin detalles internos.
export class AppError extends Error {}
