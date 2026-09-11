// Catch-all del dashboard: una ruta desconocida bajo /app dispara el not-found del
// segmento, dentro del layout.
import { notFound } from 'next/navigation'

export default function CatchAll() {
  notFound()
}
