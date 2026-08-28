// Color de las categorías: se elige solo, y nunca repetido.
//
// Antes se elegía a mano de una paleta de ocho, así que a partir de la novena
// categoría había repetidos sí o sí — y elegir color al dar de alta un gasto
// es trabajo que no aporta nada. Ahora el color lo pone la aplicación: busca
// el TONO más alejado de los que ya se usan, así que cada categoría nueva cae
// en el hueco más grande del círculo cromático.
//
// Saturación y luminosidad fijas: son las que se ven bien sobre el fondo
// oscuro del dashboard (y las que ya tenía la paleta original).

const SATURACION = 0.62
const LUMINOSIDAD = 0.55

/** '#rrggbb' → tono en grados (0-359), o null si no es un hex válido. */
export function tonoDe(hex: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  const h =
    max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round(((h * 60) % 360 + 360) % 360)
}

/** Tono (0-359) → '#rrggbb' con la saturación y luminosidad de la casa. */
export function colorDeTono(tono: number): string {
  const c = (1 - Math.abs(2 * LUMINOSIDAD - 1)) * SATURACION
  const h = (((tono % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = LUMINOSIDAD - c / 2
  const [r, g, b] =
    h < 1 ? [c, x, 0]
    : h < 2 ? [x, c, 0]
    : h < 3 ? [0, c, x]
    : h < 4 ? [0, x, c]
    : h < 5 ? [x, 0, c]
    : [c, 0, x]
  const hex = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/** Distancia entre dos tonos por el lado corto del círculo (0-180). */
const distancia = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Color para una categoría nueva: el tono más lejano de todos los que ya se
 * usan. Con la lista vacía sale el esmeralda del tema, que es el color de la
 * casa; a partir de ahí, cada uno cae en el hueco más grande que quede.
 *
 * Recorre los 360 tonos en vez de repartir por ángulo áureo porque así también
 * reacciona a los colores que ya había (los 19 sembrados) y a los huecos que
 * deja borrar una categoría.
 */
export function colorLibre(usados: string[]): string {
  const tonos = usados.map(tonoDe).filter((t): t is number => t !== null)
  if (!tonos.length) return colorDeTono(160) // esmeralda, como --primary

  let mejor = 0
  let mejorDistancia = -1
  for (let t = 0; t < 360; t += 1) {
    const d = Math.min(...tonos.map((usado) => distancia(t, usado)))
    if (d > mejorDistancia) {
      mejorDistancia = d
      mejor = t
    }
  }
  return colorDeTono(mejor)
}
