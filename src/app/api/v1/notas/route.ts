// POST /api/v1/notas: guarda una nota desde el móvil. Admite `texto` plano (se
// pasa a párrafos) o `contenidoHtml`, que pasa por el mismo saneador del editor.
import { revalidatePath } from 'next/cache'
import { altaNota, textoAHtml } from '@/lib/alta-nota'
import { log } from '@/lib/log'
import { aTexto, autenticar, jsonError, jsonOk, leerJson } from '../_comun'

export async function POST(req: Request) {
  const auth = await autenticar(req)
  if ('respuesta' in auth) return auth.respuesta

  const cuerpo = await leerJson(req)
  if ('respuesta' in cuerpo) return cuerpo.respuesta
  const d = cuerpo.datos

  const html = aTexto(d.contenidoHtml ?? d.content)
  const texto = aTexto(d.texto ?? d.text)
  if (!html && !texto) return jsonError('Falta el texto de la nota', 400)

  const res = await altaNota({
    title: aTexto(d.titulo ?? d.title),
    content: html ?? textoAHtml(texto ?? ''),
  })
  if (res.error !== undefined) return jsonError(res.error, 400)

  revalidatePath('/app/panel')
  log.info('api', 'nota guardada', { uuid: res.uuid })

  return jsonOk({ nota: { uuid: res.uuid, titulo: res.title }, mensaje: 'Nota guardada' }, 201)
}

export async function GET() {
  return jsonError('Método no permitido: usa POST', 405)
}
