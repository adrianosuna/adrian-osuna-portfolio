// Ayudante compartido de las auditorías axe. No es una suite (el `include` de
// vitest pide `*.test.ts`), sino la configuración común: vive aquí porque la
// usan `accesibilidad.dom.test.tsx` y las suites que montan un componente con
// sus server actions mockeadas y no pueden importar aquel fichero.
import axe from 'axe-core'

/** Pasa axe por el contenedor y devuelve las violaciones legibles. */
export async function auditar(nodo: Element) {
  const res = await axe.run(nodo, {
    rules: {
      // Sin layout, esta regla no es evaluable en jsdom. Los contrastes se
      // miden sobre el CSS compilado, no aquí.
      'color-contrast': { enabled: false },
      // Regla de PÁGINA ("todo el contenido dentro de un landmark"): aquí se
      // audita un fragmento suelto, que por definición no tiene main ni nav.
      // Los landmarks del dashboard los pone el layout, no estos componentes.
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
