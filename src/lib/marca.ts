// La marca: el monograma AO de Adrián, en UN solo sitio.
//
// El logo es un dibujo, no una tipografía —una A de trazos rectos entrelazada
// con un anillo O—, así que no se puede escribir con `font-weight: 800` como
// el «AO.» que sustituyó el 11/09/2026. Vive aquí, sin `server-only` y sin
// depender de React, por el mismo motivo que `fechas.ts` o `topes.ts`: lo
// necesitan a la vez el componente de la interfaz (`ui/logotipo.tsx`), el
// favicon, el icono de iOS, las pantallas de arranque y la tarjeta de
// OpenGraph. Una segunda copia del trazo es exactamente cómo se acaba con dos
// logos distintos según por dónde se mire.
//
// El trazo salió de vectorizar el PNG original (`docs/marca/logo-blanco.png`,
// 1672×941): contorno seguido sobre una máscara supermuestreada y simplificado
// con Douglas-Peucker. La desviación máxima es 0,07 % del ancho —a 512 px, medio
// píxel—, y al rasterizarlo de vuelta coincide con el original en el 99,2 % de
// los píxeles; el resto es el filo del borde.

/** Caja del trazo. La proporción (1,887:1) es la del logo original. */
export const MARCA_ANCHO = 1000
export const MARCA_ALTO = 530

/**
 * ⚠ Se pinta con **`fill-rule: evenodd`**, no con el `nonzero` por defecto.
 *
 * Son tres contornos —el anillo, la A con el arco inferior, y el hueco
 * triangular de la A— y el tercero es un AGUJERO dentro del segundo. Con
 * `nonzero` ese hueco se rellenaría y la A saldría maciza. Quien monte el
 * trazo a mano en otro sitio tiene que llevarse la regla con él.
 */
export const MARCA_D =
  'M732.5 0 L772.8 2 L817.8 12.8 L856.6 29.6 L897.9 57.2 L911.7 69.4 L937.7 97 L959.2 127.6 L978.1 163.9 L989.8 196 L997.4 230.7 L1000 259.3 L1000 280.2 L997.4 303.7 L993.4 323.1 L987.2 344.1 L979.6 362.9 L961.2 395.1 L939.3 421.1 L918.3 438.5 L904.5 447.2 L890.3 454.8 L869.3 462.5 L841.2 467.1 L850.9 453.8 L860.1 444.6 L878 418.1 L893.3 389.5 L902.5 367.5 L910.7 342 L916.8 312.4 L919.3 288.4 L919.3 259.8 L915.3 228.7 L910.2 208.3 L901.5 185.3 L891.8 165.4 L881.1 148.5 L865.7 129.1 L842.3 107.2 L807 84.7 L789.7 77.1 L763.7 69.4 L734.6 65.3 L704.4 65.8 L679.9 69.4 L657 75.5 L636.5 83.2 L593.7 104.6 L555.4 131.2 L515.1 163.9 L533.9 128.1 L559.5 90.9 L579.4 67.9 L604.4 45.4 L630.9 28.1 L661.1 14.3 L691.2 5.1ZM351.7 1.5 L371.1 24.5 L460.9 145.5 L486 176.6 L642.7 393.6 L660.5 415 L679.4 433.4 L707.5 454.8 L723.8 464 L749.9 474.7 L773.4 480.9 L799.4 483.9 L825.9 483.9 L861.2 479.3 L884.1 472.2 L886.7 472.7 L863.2 492.1 L836.7 508.4 L805 521.2 L769.8 528.8 L739.7 529.9 L708 525.3 L676.4 515.1 L644.7 497.7 L629.4 487 L612 471.7 L587.5 444.1 L530.9 365 L522.2 350.7 L481.9 296.1 L471.2 278.7 L403.8 186.3 L398.7 177.1 L393.1 171.5 L372.6 141.4 L357.3 122.5 L355.3 117.4 L351.7 116.4 L313.9 171.5 L289.9 202.7 L247.1 264.9 L216.9 304.7 L82.7 492.6 L80.7 494.1 L0.5 493.6 L0 492.1 L17.9 468.1 L24 457.4 L54.6 416 L112.3 332.8 L142.9 292 L221.5 179.7 L329.8 29.6ZM282.3 293.5 L327.7 294 L359.4 299.1 L393.6 311.4 L420.6 328.2 L449.2 355.8 L555.4 500.8 L562.5 513 L478.8 513 L472.2 512 L465 508.4 L446.1 485.5 L376.2 389.5 L364.5 375.7 L343 355.3 L314.4 334.4 L284.8 320.6 L257.8 314.4 L230.7 313.4 L245 294.5Z'

/** Fondo de los iconos (el de la paleta pública). */
export const MARCA_FONDO = '#0a1512'
/** La marca sobre fondo oscuro: es un logo BLANCO, y así se entregó. */
export const MARCA_TINTA = '#ffffff'
/** Y sobre fondo claro (la plantilla de correo), la tinta oscura de la paleta. */
export const MARCA_TINTA_CLARO = '#10241d'
