'use client'

// Tooltip compartido por TODO lo que muestra datos: las gráficas de Chart.js y
// el mapa de calor de visitas (que sigue siendo CSS Grid, no canvas).
//
// Un solo div global con `position: fixed`, inmune a contenedores con scroll u
// overflow, y colocado en coordenadas de viewport. Antes vivía dentro del
// tooltip de Chart.js; se extrajo para que el heatmap no tuviera que quedarse
// con el tooltip gris del navegador.
import { coloresTema } from './comun'

const ID = 'grafica-tooltip'

// Escape de HTML para el texto que entra en el tooltip. Este es el único sitio
// del proyecto donde se construye HTML a mano y se inyecta con `innerHTML`, así
// que aquí NO vale la premisa de "React escapa todo" con la que se descartó la
// CSP con nonces. El texto que llega —nombres de categoría propios— es de bajo
// riesgo, pero escaparlo mantiene esa premisa cierta en todo el sitio. El color
// no pasa por aquí: viene de la paleta del código y va en un atributo `style`.
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const elemento = () => {
  let el = document.getElementById(ID)
  if (!el) {
    el = document.createElement('div')
    el.id = ID
    Object.assign(el.style, {
      position: 'fixed',
      pointerEvents: 'none',
      transition: 'opacity .12s ease',
      zIndex: '60',
      opacity: '0',
      left: '0',
      top: '0',
    })
    document.body.appendChild(el)
  }
  return el
}

/** Una fila del tooltip: cuadradito de color + nombre + valor destacado. */
export const filaTooltip = ({
  color,
  nombre,
  valor,
}: {
  color?: string
  nombre: string
  valor: string
}) => {
  const c = coloresTema()
  const punto = color
    ? `<span style="width:9px;height:9px;border-radius:2px;background:${color};flex:none"></span>`
    : ''
  return `<div style="display:flex;align-items:center;gap:8px;padding:1px 0">
    ${punto}
    <span style="color:${c.suave}">${esc(nombre)}: <strong style="color:${c.texto}">${esc(valor)}</strong></span>
  </div>`
}

/** Envoltorio con el título opcional y el marco del tooltip. */
export const marcoTooltip = (filas: string, titulo?: string) => {
  const c = coloresTema()
  const cabecera = titulo
    ? `<div style="padding:6px 10px;font-weight:600;font-size:12px;color:${c.texto};border-bottom:1px solid ${c.borde}">${esc(titulo)}</div>`
    : ''
  return `<div style="background:${c.fondo};border:1px solid ${c.borde};border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,.45);font-size:12px;overflow:hidden;min-width:130px">
    ${cabecera}<div style="padding:7px 10px">${filas}</div></div>`
}

/**
 * Muestra el tooltip en unas coordenadas de VIEWPORT. Si no cabe a la derecha
 * se abre a la izquierda, y si no cabe abajo sube: nunca se sale de pantalla,
 * que en móvil pasaba con las celdas del borde derecho.
 */
export const mostrarTooltip = (html: string, x: number, y: number) => {
  const el = elemento()
  el.innerHTML = html
  const { width: w, height: h } = el.getBoundingClientRect()
  el.style.opacity = '1'
  el.style.left = `${x + w + 16 > window.innerWidth ? Math.max(8, x - w - 8) : x + 8}px`
  el.style.top = `${y + h + 8 > window.innerHeight ? Math.max(8, y - h) : y}px`
}

export const ocultarTooltip = () => {
  const el = document.getElementById(ID)
  if (el) el.style.opacity = '0'
}
