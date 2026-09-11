// Genera las piezas de la marca desde el PNG maestro: `MARCA_D`, icon.svg,
// favicon.ico y el PNG del correo. Solo si cambia el logo (`pnpm marca`). Sin dependencias.
import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAESTRO = join(RAIZ, 'docs/marca/logo-blanco.png')

// Encuadre del favicon: de borde a borde, sin placa que respetar. El icono de iOS
// deja margen (54/64) y su encuadre vive en `apple-icon.tsx`.
const ENCUADRE_SUELTO = 64 / 64
/** El favicon del navegador va en NEGRO y sin fondo (petición de Adrián). */
const NEGRO = '#000000'
/** Y en blanco cuando el navegador va en tema oscuro. */
const TINTA = '#ffffff'
// Plantilla de correo: fondo claro COCIDO (ver la nota de `lib/correo.ts`).
const CORREO_FONDO = '#eef2f0'
const CORREO_TINTA = '#10241d'

const ANCHO_CAJA = 1000
const ALTO_CAJA = 530
/** Supermuestreo de la máscara y tolerancia de Douglas-Peucker (en esas unidades). */
const ESCALA = 3
const TOL = 2

// ─────────────────────────── PNG: decodificar ───────────────────────────

function decodificar(ruta) {
  const b = readFileSync(ruta)
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20)
  if (b[24] !== 8 || b[25] !== 6) throw new Error('el maestro tiene que ser PNG RGBA de 8 bits')
  let off = 8
  const trozos = []
  while (off < b.length) {
    const len = b.readUInt32BE(off)
    if (b.toString('ascii', off + 4, off + 8) === 'IDAT') trozos.push(b.subarray(off + 8, off + 8 + len))
    off += 12 + len
  }
  const bruto = inflateSync(Buffer.concat(trozos))
  const paso = w * 4
  const px = Buffer.alloc(h * paso)
  let p = 0
  for (let y = 0; y < h; y++) {
    const filtro = bruto[p++]
    const fila = bruto.subarray(p, p + paso); p += paso
    const dest = px.subarray(y * paso, (y + 1) * paso)
    const prev = y > 0 ? px.subarray((y - 1) * paso, y * paso) : null
    for (let x = 0; x < paso; x++) {
      const a = x >= 4 ? dest[x - 4] : 0
      const bb = prev ? prev[x] : 0
      const c = prev && x >= 4 ? prev[x - 4] : 0
      let v = fila[x]
      if (filtro === 1) v += a
      else if (filtro === 2) v += bb
      else if (filtro === 3) v += (a + bb) >> 1
      else if (filtro === 4) {
        const pp = a + bb - c
        const pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c
      }
      dest[x] = v & 255
    }
  }
  return { w, h, px }
}

const { w: W, h: H, px: PX } = decodificar(MAESTRO)
const alfa = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : PX[(y * W + x) * 4 + 3])

/** Recuadro real de la marca dentro del maestro (el PNG trae mucho margen). */
function recuadro() {
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alfa(x, y) > 10) {
        if (x < x0) x0 = x; if (x > x1) x1 = x
        if (y < y0) y0 = y; if (y > y1) y1 = y
      }
    }
  }
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 }
}
const CAJA = recuadro()

// ─────────────────────────── trazo vectorial ───────────────────────────

function alfaBilineal(fx, fy) {
  const x0 = Math.floor(fx), y0 = Math.floor(fy)
  const tx = fx - x0, ty = fy - y0
  const a = alfa(x0, y0), b = alfa(x0 + 1, y0), c = alfa(x0, y0 + 1), d = alfa(x0 + 1, y0 + 1)
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
}

/** Contorno por grietas entre píxeles sobre una máscara supermuestreada: cada esquina
 *  tiene tantas salidas como entradas, así que los contornos cierran siempre. */
function trazar() {
  const margen = 6
  const bx0 = CAJA.x0 - margen, by0 = CAJA.y0 - margen
  const ancho = (CAJA.x1 - CAJA.x0 + margen * 2) * ESCALA
  const alto = (CAJA.y1 - CAJA.y0 + margen * 2) * ESCALA
  const lleno = new Uint8Array(ancho * alto)
  for (let j = 0; j < alto; j++) {
    for (let i = 0; i < ancho; i++) {
      lleno[j * ancho + i] = alfaBilineal(bx0 + (i + 0.5) / ESCALA, by0 + (j + 0.5) / ESCALA) >= 128 ? 1 : 0
    }
  }
  const on = (i, j) => (i < 0 || j < 0 || i >= ancho || j >= alto ? 0 : lleno[j * ancho + i])

  // Grieta dirigida con el píxel lleno a la derecha: los huecos salen con el
  // giro contrario, que es justo lo que `evenodd` necesita.
  const salida = new Map()
  const añadir = (a, b) => {
    const k = `${a[0]},${a[1]}`
    if (!salida.has(k)) salida.set(k, [])
    salida.get(k).push(b)
  }
  for (let j = 0; j < alto; j++) {
    for (let i = 0; i < ancho; i++) {
      if (!on(i, j)) continue
      if (!on(i, j - 1)) añadir([i, j], [i + 1, j])
      if (!on(i + 1, j)) añadir([i + 1, j], [i + 1, j + 1])
      if (!on(i, j + 1)) añadir([i + 1, j + 1], [i, j + 1])
      if (!on(i - 1, j)) añadir([i, j + 1], [i, j])
    }
  }

  const poligonos = []
  for (const clave of [...salida.keys()]) {
    while (salida.get(clave)?.length) {
      const inicio = clave.split(',').map(Number)
      const poli = [inicio]
      let actual = inicio
      for (;;) {
        const lista = salida.get(`${actual[0]},${actual[1]}`)
        if (!lista?.length) break
        // Con dos salidas (píxeles que solo se tocan en diagonal) se sigue la
        // que menos gira: mantiene el trazo continuo en vez de cortarlo.
        let idx = 0
        if (lista.length > 1 && poli.length > 1) {
          const prev = poli[poli.length - 2]
          const dir = [actual[0] - prev[0], actual[1] - prev[1]]
          let mejor = -Infinity
          lista.forEach((n, i) => {
            const punto = dir[0] * (n[0] - actual[0]) + dir[1] * (n[1] - actual[1])
            if (punto > mejor) { mejor = punto; idx = i }
          })
        }
        const sig = lista.splice(idx, 1)[0]
        if (!lista.length) salida.delete(`${actual[0]},${actual[1]}`)
        poli.push(sig)
        actual = sig
        if (sig[0] === inicio[0] && sig[1] === inicio[1]) break
      }
      if (poli.length > 12) poligonos.push(poli)
    }
  }
  return poligonos.map((p) => simplificar(p, TOL))
}

/** Douglas-Peucker: quita los puntos que no cambian la silueta. */
function simplificar(pts, tol) {
  if (pts.length < 3) return pts
  const dist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const l2 = dx * dx + dy * dy
    if (!l2) return Math.hypot(p[0] - a[0], p[1] - a[1])
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
  }
  const guardar = new Array(pts.length).fill(false)
  guardar[0] = guardar[pts.length - 1] = true
  const pila = [[0, pts.length - 1]]
  while (pila.length) {
    const [i, j] = pila.pop()
    let max = 0, idx = -1
    for (let k = i + 1; k < j; k++) {
      const d = dist(pts[k], pts[i], pts[j])
      if (d > max) { max = d; idx = k }
    }
    if (max > tol) { guardar[idx] = true; pila.push([i, idx], [idx, j]) }
  }
  return pts.filter((_, i) => guardar[i])
}

/** Comprueba el trazo rellenándolo de vuelta (par-impar) contra la máscara original:
 *  un contorno perdido no se ve a ojo. */
function fidelidad(poligonos) {
  const aristas = []
  for (const p of poligonos) for (let i = 0; i < p.length - 1; i++) aristas.push([p[i], p[i + 1]])
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of poligonos) for (const q of p) {
    x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0])
    y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1])
  }
  let dif = 0, llenos = 0
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    const cortes = []
    for (const [a, b] of aristas) {
      if ((a[1] <= y + 0.5) === (b[1] <= y + 0.5)) continue
      cortes.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
    }
    cortes.sort((m, n) => m - n)
    const dentro = new Set()
    for (let c = 0; c + 1 < cortes.length; c += 2) {
      for (let i = Math.ceil(cortes[c] - 0.5); i <= Math.floor(cortes[c + 1] - 0.5); i++) dentro.add(i)
    }
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      // Coordenadas de la máscara → coordenadas del maestro.
      const orig = alfaBilineal(CAJA.x0 - 6 + (x + 0.5) / ESCALA, CAJA.y0 - 6 + (y + 0.5) / ESCALA) >= 128
      if (orig) llenos++
      if (orig !== dentro.has(x)) dif++
    }
  }
  return { dif, llenos, pct: (dif / llenos) * 100 }
}

function pathDe(poligonos) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of poligonos) for (const q of p) {
    x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0])
    y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1])
  }
  const k = ANCHO_CAJA / (x1 - x0)
  const n = (v) => {
    const r = Math.round(v * 10) / 10
    return String(Number.isInteger(r) ? r : r.toFixed(1))
  }
  const d = poligonos
    .map((p) => 'M' + p.slice(0, -1).map((q, i) => `${i ? 'L' : ''}${n((q[0] - x0) * k)} ${n((q[1] - y0) * k)}`).join(' ') + 'Z')
    .join('')
  return { d, alto: (y1 - y0) * k }
}

// ─────────────────────────── PNG: codificar ───────────────────────────

const TABLA_CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function trozo(tipo, datos) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  let c = -1
  for (let i = 0; i < cuerpo.length; i++) c = TABLA_CRC[(c ^ cuerpo[i]) & 255] ^ (c >>> 8)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE((c ^ -1) >>> 0)
  return Buffer.concat([len, cuerpo, crc])
}
function codificarPNG(ancho, alto, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const paso = ancho * 4
  const bruto = Buffer.alloc(alto * (1 + paso))
  for (let j = 0; j < alto; j++) rgba.copy(bruto, j * (1 + paso) + 1, j * paso, (j + 1) * paso)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(bruto, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

// ─────────────────────────── rásteres ───────────────────────────

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]

/** Cobertura de la marca a un tamaño con filtro de caja. Se remuestrea el maestro y
 *  no el trazo: conserva mejor el filo. */
function cobertura(ancho, alto) {
  const out = new Float32Array(ancho * alto)
  const cw = CAJA.x1 - CAJA.x0, ch = CAJA.y1 - CAJA.y0
  for (let j = 0; j < alto; j++) {
    const sy0 = CAJA.y0 + (j * ch) / alto, sy1 = CAJA.y0 + ((j + 1) * ch) / alto
    for (let i = 0; i < ancho; i++) {
      const sx0 = CAJA.x0 + (i * cw) / ancho, sx1 = CAJA.x0 + ((i + 1) * cw) / ancho
      let suma = 0, n = 0
      for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
        const fy = Math.min(sy1, y + 1) - Math.max(sy0, y)
        if (fy <= 0) continue
        for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
          const fx = Math.min(sx1, x + 1) - Math.max(sx0, x)
          if (fx <= 0) continue
          suma += alfa(x, y) * fx * fy
          n += fx * fy
        }
      }
      out[j * ancho + i] = n > 0 ? suma / n / 255 : 0
    }
  }
  return out
}

/** Lienzo con la marca centrada. Con `colorFondo` null el suavizado va por el canal
 *  alfa: mezclando con un fondo inexistente quedaría una orla clara. */
function lienzo(ancho, alto, anchoMarca, colorFondo, colorTinta) {
  const fondo = colorFondo ? hex(colorFondo) : null
  const tinta = hex(colorTinta)
  const altoMarca = Math.max(1, Math.round((anchoMarca * ALTO_CAJA) / ANCHO_CAJA))
  const cov = cobertura(anchoMarca, altoMarca)
  const rgba = Buffer.alloc(ancho * alto * 4)
  const ox = Math.round((ancho - anchoMarca) / 2), oy = Math.round((alto - altoMarca) / 2)
  for (let j = 0; j < alto; j++) {
    for (let i = 0; i < ancho; i++) {
      const k = (j * ancho + i) * 4
      const mi = i - ox, mj = j - oy
      const m = mi >= 0 && mj >= 0 && mi < anchoMarca && mj < altoMarca ? cov[mj * anchoMarca + mi] : 0
      for (let c = 0; c < 3; c++) {
        rgba[k + c] = fondo ? Math.round(fondo[c] * (1 - m) + tinta[c] * m) : tinta[c]
      }
      rgba[k + 3] = fondo ? 255 : Math.round(m * 255)
    }
  }
  return codificarPNG(ancho, alto, rgba)
}

function empaquetarICO(marcos) {
  const cab = Buffer.alloc(6)
  cab.writeUInt16LE(1, 2)
  cab.writeUInt16LE(marcos.length, 4)
  let off = 6 + marcos.length * 16
  const dir = marcos.map((m) => {
    const e = Buffer.alloc(16)
    e[0] = m.lado
    e[1] = m.lado
    e.writeUInt16LE(1, 4)  // planos
    e.writeUInt16LE(32, 6) // bits por píxel
    e.writeUInt32LE(m.datos.length, 8)
    e.writeUInt32LE(off, 12)
    off += m.datos.length
    return e
  })
  return Buffer.concat([cab, ...dir, ...marcos.map((m) => m.datos)])
}

// ─────────────────────────── ejecución ───────────────────────────

const poligonos = trazar()
const { d, alto } = pathDe(poligonos)
const fid = fidelidad(poligonos)
const proporcion = Math.abs(alto - ALTO_CAJA) / ALTO_CAJA

console.log(`maestro    ${W}×${H}, marca en ${CAJA.x1 - CAJA.x0}×${CAJA.y1 - CAJA.y0}`)
console.log(`trazo      ${poligonos.length} contornos, ${poligonos.reduce((s, p) => s + p.length, 0)} puntos, d de ${d.length} caracteres`)
console.log(`fidelidad  ${fid.dif} px distintos de ${fid.llenos} (${fid.pct.toFixed(2)} %) — el resto es el filo del borde`)

if (poligonos.length !== 3) {
  console.error(`\n⚠ Se esperaban 3 contornos (anillo, A y hueco de la A) y salieron ${poligonos.length}.`)
  console.error('  Revisa el maestro antes de dar esto por bueno.')
}
if (proporcion > 0.01) {
  console.error(`\n⚠ La proporción ha cambiado: el alto sale ${alto.toFixed(1)} y MARCA_ALTO es ${ALTO_CAJA}.`)
  console.error('  Actualiza MARCA_ALTO en src/lib/marca.ts o el logo se verá estirado.')
}

// 1) El trazo, en src/lib/marca.ts (solo esa línea: el resto son las notas).
const rutaMarca = join(RAIZ, 'src/lib/marca.ts')
const marcaTs = readFileSync(rutaMarca, 'utf8')
const sustituida = marcaTs.replace(/(export const MARCA_D =\r?\n\s*)'[^']*'/, `$1'${d}'`)
if (sustituida === marcaTs && !marcaTs.includes(`'${d}'`)) {
  throw new Error('no se encontró la constante MARCA_D en src/lib/marca.ts')
}
writeFileSync(rutaMarca, sustituida)

// 2) El favicon SVG, negro y sin fondo. Lleva `prefers-color-scheme` dentro: sin
// fondo, el negro no se ve sobre la barra de pestañas oscura.
const suelto = {
  x: ((64 - 64 * ENCUADRE_SUELTO) / 2).toFixed(2),
  y: ((64 - 64 * ENCUADRE_SUELTO * (ALTO_CAJA / ANCHO_CAJA)) / 2).toFixed(2),
  k: ((64 * ENCUADRE_SUELTO) / ANCHO_CAJA).toFixed(4),
}
writeFileSync(join(RAIZ, 'src/app/icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- GENERADO por scripts/generar-marca.mjs — no editar a mano.
       El trazo es el mismo de src/lib/marca.ts (MARCA_D) escalado a la caja. -->
  <style>
    path { fill: ${NEGRO} }
    @media (prefers-color-scheme: dark) { path { fill: ${TINTA} } }
  </style>
  <g transform="translate(${suelto.x} ${suelto.y}) scale(${suelto.k})" fill-rule="evenodd">
    <path d="${d}"/>
  </g>
</svg>
`)

// 3) El favicon .ico (16/32/48) a juego: negro, sin fondo ni esquinas. Sin media
// query posible, se queda en negro siempre.
const marcos = [16, 32, 48].map((lado) => ({
  lado,
  datos: lienzo(lado, lado, Math.round(lado * ENCUADRE_SUELTO), null, NEGRO),
}))
writeFileSync(join(RAIZ, 'public/favicon.ico'), empaquetarICO(marcos))

// 4) El logo del correo: a 2× de como se muestra (66×36), sobre el fondo claro.
writeFileSync(join(RAIZ, 'public/img/logo-correo.png'), lienzo(176, 96, 160, CORREO_FONDO, CORREO_TINTA))

console.log('\nescrito:')
console.log('  src/lib/marca.ts (MARCA_D)')
console.log('  src/app/icon.svg')
console.log(`  public/favicon.ico (${marcos.map((m) => m.lado).join('/')})`)
console.log('  public/img/logo-correo.png')
