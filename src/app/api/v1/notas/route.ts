// POST /api/v1/notas — guarda una nota en el Panel de control.
//
// El caso: dictarle algo al móvil y que aparezca en las notas del dashboard sin
// abrir el navegador. El Atajo manda texto plano y aquí se convierte en
// párrafos; quien quiera mandar HTML puede hacerlo con `contenidoHtml` y pasa
// por el MISMO saneador que el editor visual.
//
// Cuerpo (JSON):
//   { "titulo": "Ideas", "texto": "Primera línea\nSegunda línea" }
//   { "titulo": "Ideas", "contenidoHtml": "<p>...</p>" }
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
