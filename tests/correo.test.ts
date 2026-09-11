// Plantilla de los correos del panel: el contenido queda envuelto en la
// identidad de la casa y las piezas (tarjeta, botón) llevan lo que deben.
import { describe, expect, it } from 'vitest'
import { botonHtml, plantilla, tarjetaHtml } from '@/lib/correo'

describe('plantilla de correo', () => {
  const html = plantilla('Asunto de prueba', '<p>Cuerpo del mensaje</p>')

  it('envuelve el contenido con la identidad: la marca, el título y el footer', () => {
    // La marca va como imagen alojada, no en línea: ver la nota de `lib/correo.ts`.
    expect(html).toContain('/img/logo-correo.png')
    // Y SIEMPRE con `alt`: en Outlook las imágenes vienen bloqueadas de fábrica,
    // y sin él la cabecera del correo se queda en blanco.
    expect(html).toMatch(/<img[^>]+alt="Adrián Osuna"/)
    expect(html).toContain('Asunto de prueba')
    expect(html).toContain('<p>Cuerpo del mensaje</p>')
    expect(html).toContain('adrianosuna.com')
  })

  it('es email-safe: fondo claro y sin hoja de estilos (<style>)', () => {
    expect(html).toContain('background:#eef2f0')
    expect(html).not.toContain('<style')
  })
})

describe('piezas', () => {
  it('la tarjeta refleja la gravedad en su acento (ámbar vs. rojo)', () => {
    expect(tarjetaHtml('Tarea', 'Vencía ayer', null, false)).toContain('#b45309')
    expect(tarjetaHtml('Tarea', 'Vencía hace mucho', null, true)).toContain('#b91c1c')
  })

  it('la tarjeta incluye la nota solo si existe', () => {
    expect(tarjetaHtml('Tarea', 'd', 'Recordatorio', false)).toContain('Recordatorio')
    expect(tarjetaHtml('Tarea', 'd', null, false)).not.toContain('undefined')
  })

  it('el botón enlaza a la URL con su texto', () => {
    const boton = botonHtml('Abrir el panel', 'https://adrianosuna.com/app/panel')
    expect(boton).toContain('href="https://adrianosuna.com/app/panel"')
    expect(boton).toContain('Abrir el panel')
  })
})
