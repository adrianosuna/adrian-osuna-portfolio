// Arranque de los tests. Corre en TODAS las suites, también las de entorno
// `node`, así que todo va tras comprobar que hay `window`.
//
// jsdom no implementa dos cosas que el navegador sí y que ya se usan en el
// dashboard. Se rellenan aquí y no con guardas (`el.scrollIntoView?.()`) en el
// componente: una guarda así no protege de nada real —en un navegador siempre
// existen— y lo que hace es esconder el fallo si algún día se llama sobre algo
// que no es un elemento.
if (typeof window !== 'undefined') {
  // Usado para respetar `prefers-reduced-motion`. Devuelve "no reducido", que
  // es el ajuste por defecto de un navegador.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
  }
  // jsdom no hace scroll: basta con que exista y no reviente.
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
}
