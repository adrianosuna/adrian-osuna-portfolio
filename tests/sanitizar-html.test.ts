// Saneado del HTML de las notas (src/lib/sanitizar-html.ts): la seguridad de
// guardar HTML depende de que aquí caiga TODO lo peligroso y sobreviva solo la
// allowlist. `server-only` se alias-ea a un stub en vitest; sanitize-html corre
// de verdad.
import { describe, expect, it } from 'vitest'
import { sanitizarNota, textoDe } from '@/lib/sanitizar-html'

describe('sanitizarNota', () => {
  it('conserva el formato permitido', () => {
    const html = '<p>Hola <b>mundo</b> y <i>algo</i></p><ul><li>uno</li></ul><h3>Tít</h3>'
    const out = sanitizarNota(html)
    expect(out).toContain('<b>mundo</b>')
    expect(out).toContain('<i>algo</i>')
    expect(out).toContain('<li>uno</li>')
    expect(out).toContain('<h3>Tít</h3>')
  })

  it('elimina <script>, <style> y las etiquetas fuera de la allowlist', () => {
    const out = sanitizarNota('<p>ok</p><script>alert(1)</script><style>x{}</style><img src=x>')
    expect(out).toContain('<p>ok</p>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<style')
    expect(out).not.toContain('<img')
  })

  it('quita los manejadores on* y las clases/estilos', () => {
    const out = sanitizarNota('<p onclick="alert(1)" class="x" style="color:red">hola</p>')
    expect(out).toContain('hola')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('class')
    expect(out).not.toContain('style')
  })

  it('un enlace javascript: pierde el href; el http se queda y abre seguro', () => {
    const malo = sanitizarNota('<a href="javascript:alert(1)">x</a>')
    expect(malo).not.toContain('javascript:')

    const bueno = sanitizarNota('<a href="https://adrianosuna.com">web</a>')
    expect(bueno).toContain('href="https://adrianosuna.com"')
    expect(bueno).toContain('target="_blank"')
    expect(bueno).toContain('rel="noopener noreferrer nofollow"')
  })
})

describe('textoDe', () => {
  it('quita las etiquetas y normaliza espacios', () => {
    expect(textoDe('<p>Hola <b>mundo</b></p>')).toBe('Hola mundo')
  })

  it('un editor vacío da cadena vacía (para detectar la nota vacía)', () => {
    expect(textoDe('<p><br></p>')).toBe('')
    expect(textoDe('<div></div>')).toBe('')
    expect(textoDe('   ')).toBe('')
  })
})
