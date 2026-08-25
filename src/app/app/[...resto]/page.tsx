// Catch-all del dashboard: cualquier ruta desconocida bajo /app dispara el
// not-found del segmento, que se renderiza DENTRO del layout (menú incluido),
// como el NotFoundApp del proyecto original.
import { notFound } from 'next/navigation'

export default function CatchAll() {
  notFound()
}
