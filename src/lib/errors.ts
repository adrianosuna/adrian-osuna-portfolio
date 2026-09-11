// Error de aplicación con mensaje apto para el usuario: los catch de las actions
// solo muestran el mensaje si es de esta clase; el resto sale como "Error inesperado".
export class AppError extends Error {}
