// Arranque de los tests: rellena `matchMedia` y `scrollIntoView` en jsdom, tras
// comprobar que hay `window`. Aquí y no con guardas en el componente.
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
