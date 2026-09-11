// Ayudante compartido de las auditorías axe (no es suite). Lo usan las suites que
// montan componentes con sus server actions mockeadas.
import axe from 'axe-core'

/** Pasa axe por el contenedor y devuelve las violaciones legibles. */
export async function auditar(nodo: Element) {
  const res = await axe.run(nodo, {
    rules: {
      // Sin layout, esta regla no es evaluable en jsdom. Los contrastes se
      // miden sobre el CSS compilado, no aquí.
      'color-contrast': { enabled: false },
      // Regla de página ("todo dentro de un landmark"): aquí se audita un fragmento suelto.
      // Los landmarks los pone el layout.
      region: { enabled: false },
    },
  })
  return res.violations.map((v) => ({
    regla: v.id,
    impacto: v.impact,
    // El selector del primer nodo afectado: es lo que hace falta para arreglarlo.
    donde: v.nodes[0]?.target?.join(' '),
    ayuda: v.help,
  }))
}
