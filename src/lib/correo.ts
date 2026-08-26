// Envío de correo (solo servidor): avisos del sistema de mantenimiento.
// SMTP genérico por variables de entorno (con Gmail: smtp.gmail.com:465 y una
// contraseña de aplicación). Sin configurar, todo queda inactivo sin romper.
// Todos los envíos pasan por la plantilla de la casa: fondo claro (los clientes
// de correo castigan los fondos oscuros), esmeralda de acento, logo AO. y
// footer común — el contenido de cada correo solo aporta su cuerpo.
import 'server-only'
import nodemailer from 'nodemailer'

export const correoConfigurado = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.ALERT_EMAIL)

// Prefijo de TODOS los asuntos del sistema: permite filtrarlos a una carpeta
// con una regla de "el asunto contiene [Panel AO]".
const PREFIJO_ASUNTO = '[Panel AO]'

// Paleta clara de la plantilla (el esmeralda #047857 da contraste AA en claro).
const C = {
  fondo: '#eef2f0',
  tarjeta: '#ffffff',
  borde: '#e2e8e5',
  texto: '#1a2e28',
  apagado: '#64766f',
  esmeralda: '#047857',
  tinta: '#10241d',
}

const FUENTE = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** Envuelve el cuerpo de un correo en la plantilla de la casa (email-safe:
 *  tablas y estilos inline — Gmail elimina los <style>). Exportada para tests
 *  y para previsualizarla. */
export function plantilla(titulo: string, contenido: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:${C.fondo}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo}">
    <tr>
      <td align="center" style="padding:28px 14px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px">
          <tr>
            <td style="padding:0 6px 14px;font-family:${FUENTE}">
              <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${C.tinta}">AO<span style="color:${C.esmeralda}">.</span></span>
              <span style="font-size:13px;color:${C.apagado}">&nbsp;·&nbsp;Panel de control</span>
            </td>
          </tr>
          <tr>
            <td style="background:${C.tarjeta};border:1px solid ${C.borde};border-radius:12px;padding:26px 28px;font-family:${FUENTE};color:${C.texto}">
              <h1 style="margin:0 0 14px;font-size:18px;line-height:1.35;color:${C.tinta}">${titulo}</h1>
              <div style="font-size:14px;line-height:1.6">${contenido}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 6px 0;font-family:${FUENTE};font-size:12px;line-height:1.5;color:${C.apagado}">
              Correo automático del Panel de control de
              <a href="https://adrianosuna.com" style="color:${C.esmeralda};text-decoration:none">adrianosuna.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Tarjeta de tarea para los avisos (borde izquierdo según gravedad). */
export function tarjetaHtml(titulo: string, detalle: string, nota: string | null, grave: boolean): string {
  const acento = grave ? '#b91c1c' : '#b45309'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px">
    <tr>
      <td style="background:#f8faf9;border:1px solid ${C.borde};border-left:3px solid ${acento};border-radius:8px;padding:12px 14px;font-family:${FUENTE}">
        <span style="font-size:14px;font-weight:700;color:${C.tinta}">${titulo}</span><br>
        <span style="font-size:13px;color:${C.apagado}">${detalle}</span>
        ${nota ? `<br><span style="font-size:12px;color:${C.apagado}">${nota}</span>` : ''}
      </td>
    </tr>
  </table>`
}

/** Botón de acción principal (enlace con pinta de botón, email-safe). */
export function botonHtml(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 2px">
    <tr>
      <td style="background:${C.esmeralda};border-radius:8px">
        <a href="${url}" style="display:inline-block;padding:10px 22px;font-family:${FUENTE};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${texto}</a>
      </td>
    </tr>
  </table>`
}

/** Envía un correo al ALERT_EMAIL con la plantilla de la casa.
 *  `contenido` es el cuerpo interior (párrafos, tarjetas, botón...).
 *  Lanza si el SMTP falla (el llamador decide). */
export async function enviarCorreo(asunto: string, contenido: string): Promise<void> {
  if (!correoConfigurado()) throw new Error('SMTP sin configurar')
  const puerto = Number(process.env.SMTP_PORT || 465)
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    secure: puerto === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  await transporte.sendMail({
    from: `"Panel adrianosuna.com" <${process.env.SMTP_USER}>`,
    to: process.env.ALERT_EMAIL,
    subject: `${PREFIJO_ASUNTO} ${asunto}`,
    html: plantilla(asunto, contenido),
  })
}
