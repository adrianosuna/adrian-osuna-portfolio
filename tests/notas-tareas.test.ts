// Checklists de las notas: allowlist del saneador para `ul.tareas` /
// `li[data-check]`, y el alternado por índice que usa la acción del servidor.
// Es la pieza donde un ítem marcado desde la tarjeta puede tocar el HTML
// guardado, así que interesa que ni se cuele nada ni se marque el ítem de al lado.
import { describe, expect, it } from 'vitest'
import {
  alternarTarea, progresoTareas, sanitizarNota, tareasDe,
} from '@/lib/sanitizar-html'

describe('saneado de checklists', () => {
  it('conserva la lista de tareas y el estado de cada ítem', () => {
    const html = '<ul class="tareas"><li data-check="1">Hecha</li><li data-check="0">Pendiente</li></ul>'
    const limpio = sanitizarNota(html)
    expect(limpio).toContain('class="tareas"')
    expect(limpio).toContain('data-check="1"')
    expect(limpio).toContain('data-check="0"')
  })

  it('normaliza un data-check con basura a "0"', () => {
    // Nada de dejar pasar el valor tal cual: solo '0' o '1'.
    const limpio = sanitizarNota('<ul class="tareas"><li data-check="javascript:alert(1)">x</li></ul>')
    expect(limpio).toContain('data-check="0"')
    expect(limpio).not.toContain('javascript')
  })

  it('no admite otras clases en la lista (solo "tareas")', () => {
    const limpio = sanitizarNota('<ul class="barra-carga otra"><li>x</li></ul>')
    expect(limpio).not.toContain('barra-carga')
    expect(limpio).not.toContain('otra')
  })

  it('sigue tirando lo peligroso con las checklists activadas', () => {
    const limpio = sanitizarNota(
      '<ul class="tareas"><li data-check="0" onclick="robar()">x</li></ul><script>mal()</script>',
    )
    expect(limpio).not.toContain('onclick')
    expect(limpio).not.toContain('<script')
    expect(limpio).not.toContain('mal()')
  })

  it('un checkbox de formulario NO entra en la allowlist', () => {
    // Las casillas se dibujan con CSS: el HTML de una nota no tiene controles.
    const limpio = sanitizarNota('<ul class="tareas"><li><input type="checkbox" checked>x</li></ul>')
    expect(limpio).not.toContain('<input')
  })
})

describe('lectura y alternado de tareas', () => {
  const HTML =
    '<ul class="tareas"><li data-check="0">Una</li><li data-check="1">Dos</li><li data-check="0">Tres</li></ul>'

  it('lee el estado de cada ítem en orden de documento', () => {
    expect(tareasDe(HTML)).toEqual([false, true, false])
    expect(progresoTareas(HTML)).toEqual({ hechas: 1, total: 3 })
  })

  it('una nota sin checklist no tiene progreso', () => {
    expect(progresoTareas('<p>Solo texto</p>')).toEqual({ hechas: 0, total: 0 })
    expect(tareasDe('<ul><li>Lista normal</li></ul>')).toEqual([])
  })

  it('alterna SOLO el ítem pedido', () => {
    const nuevo = alternarTarea(HTML, 2)
    expect(nuevo).not.toBeNull()
    expect(tareasDe(nuevo as string)).toEqual([false, true, true])
  })

  it('desmarca igual de bien', () => {
    expect(tareasDe(alternarTarea(HTML, 1) as string)).toEqual([false, false, false])
  })

  it('no toca el resto del contenido', () => {
    const conTexto = `<h3>Compra</h3>${HTML}<p>Nota al pie</p>`
    const nuevo = alternarTarea(conTexto, 0) as string
    expect(nuevo).toContain('<h3>Compra</h3>')
    expect(nuevo).toContain('<p>Nota al pie</p>')
  })

  it('devuelve null si el índice no existe (la nota cambió por debajo)', () => {
    expect(alternarTarea(HTML, 3)).toBeNull()
    expect(alternarTarea(HTML, -1)).toBeNull()
    expect(alternarTarea('<p>sin tareas</p>', 0)).toBeNull()
  })
})
