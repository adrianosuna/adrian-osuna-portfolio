// Coordenadas para el mapa: traduce los nombres de GA4 a un punto. Tabla local y no
// geocodificador: no abre la CSP ni manda a un tercero de dónde son las visitas.

/** Punto en grados: latitud (norte +) y longitud (este +). */
export interface Punto {
  lat: number
  lon: number
}

/** Centroide de cada país por su nombre en español (`PAISES_ES` de `lib/ga.ts`). */
export const PAISES: Record<string, Punto> = {
  España: { lat: 40.2, lon: -3.7 },
  Portugal: { lat: 39.6, lon: -8.0 },
  Francia: { lat: 46.6, lon: 2.3 },
  Alemania: { lat: 51.1, lon: 10.4 },
  Italia: { lat: 42.8, lon: 12.6 },
  'Reino Unido': { lat: 54.0, lon: -2.0 },
  Irlanda: { lat: 53.2, lon: -8.0 },
  'Países Bajos': { lat: 52.2, lon: 5.5 },
  Bélgica: { lat: 50.6, lon: 4.6 },
  Suiza: { lat: 46.8, lon: 8.2 },
  Austria: { lat: 47.6, lon: 14.1 },
  Polonia: { lat: 52.1, lon: 19.4 },
  Suecia: { lat: 62.2, lon: 15.0 },
  Noruega: { lat: 64.5, lon: 12.0 },
  Dinamarca: { lat: 56.0, lon: 9.5 },
  Finlandia: { lat: 64.5, lon: 26.0 },
  Rumanía: { lat: 45.9, lon: 25.0 },
  Grecia: { lat: 39.1, lon: 22.0 },
  Marruecos: { lat: 31.8, lon: -7.1 },
  'Estados Unidos': { lat: 39.5, lon: -98.4 },
  Canadá: { lat: 56.1, lon: -106.3 },
  México: { lat: 23.6, lon: -102.5 },
  Guatemala: { lat: 15.5, lon: -90.3 },
  'Costa Rica': { lat: 9.7, lon: -84.1 },
  Panamá: { lat: 8.5, lon: -80.8 },
  Cuba: { lat: 21.5, lon: -79.5 },
  'República Dominicana': { lat: 18.7, lon: -70.2 },
  Colombia: { lat: 4.6, lon: -74.1 },
  Venezuela: { lat: 7.1, lon: -66.6 },
  Ecuador: { lat: -1.8, lon: -78.2 },
  Perú: { lat: -9.2, lon: -75.0 },
  Bolivia: { lat: -16.3, lon: -63.6 },
  Chile: { lat: -35.7, lon: -71.5 },
  Argentina: { lat: -38.4, lon: -63.6 },
  Uruguay: { lat: -32.5, lon: -55.8 },
  Paraguay: { lat: -23.4, lon: -58.4 },
  Brasil: { lat: -14.2, lon: -51.9 },
  China: { lat: 35.9, lon: 104.2 },
  Japón: { lat: 36.2, lon: 138.3 },
  India: { lat: 20.6, lon: 79.0 },
  Australia: { lat: -25.3, lon: 133.8 },
  Sudáfrica: { lat: -30.6, lon: 22.9 },
  Rusia: { lat: 61.5, lon: 105.3 },
  Turquía: { lat: 39.0, lon: 35.2 },
  Desconocido: { lat: 0, lon: 0 },
}

/** Ciudades por su nombre en español: las capitales de provincia españolas al
 *  completo, las grandes del mundo hispanohablante y algunas capitales. */
export const CIUDADES: Record<string, Punto> = {
  Madrid: { lat: 40.417, lon: -3.703 },
  Barcelona: { lat: 41.385, lon: 2.173 },
  Valencia: { lat: 39.47, lon: -0.376 },
  Sevilla: { lat: 37.389, lon: -5.984 },
  Zaragoza: { lat: 41.649, lon: -0.888 },
  Málaga: { lat: 36.721, lon: -4.421 },
  Murcia: { lat: 37.992, lon: -1.13 },
  'Palma de Mallorca': { lat: 39.57, lon: 2.65 },
  'Las Palmas de Gran Canaria': { lat: 28.124, lon: -15.43 },
  Bilbao: { lat: 43.263, lon: -2.935 },
  Alicante: { lat: 38.345, lon: -0.481 },
  Córdoba: { lat: 37.889, lon: -4.779 },
  Valladolid: { lat: 41.652, lon: -4.724 },
  Vigo: { lat: 42.231, lon: -8.713 },
  Gijón: { lat: 43.545, lon: -5.662 },
  'A Coruña': { lat: 43.362, lon: -8.412 },
  Granada: { lat: 37.177, lon: -3.598 },
  Oviedo: { lat: 43.362, lon: -5.849 },
  Cartagena: { lat: 37.605, lon: -0.986 },
  'Santa Cruz de Tenerife': { lat: 28.469, lon: -16.254 },
  Pamplona: { lat: 42.813, lon: -1.645 },
  Almería: { lat: 36.834, lon: -2.464 },
  'San Sebastián': { lat: 43.318, lon: -1.981 },
  Santander: { lat: 43.463, lon: -3.805 },
  Castellón: { lat: 39.986, lon: -0.037 },
  'Castellón de la Plana': { lat: 39.986, lon: -0.037 },
  Burgos: { lat: 42.341, lon: -3.7 },
  Albacete: { lat: 38.995, lon: -1.858 },
  Salamanca: { lat: 40.965, lon: -5.664 },
  Logroño: { lat: 42.465, lon: -2.449 },
  Huelva: { lat: 37.261, lon: -6.944 },
  Badajoz: { lat: 38.879, lon: -6.97 },
  Lleida: { lat: 41.618, lon: 0.622 },
  Tarragona: { lat: 41.119, lon: 1.245 },
  León: { lat: 42.599, lon: -5.567 },
  Cádiz: { lat: 36.527, lon: -6.289 },
  Jaén: { lat: 37.766, lon: -3.791 },
  Ourense: { lat: 42.336, lon: -7.864 },
  Girona: { lat: 41.983, lon: 2.824 },
  Lugo: { lat: 43.012, lon: -7.556 },
  Cáceres: { lat: 39.476, lon: -6.372 },
  Toledo: { lat: 39.863, lon: -4.028 },
  Ceuta: { lat: 35.889, lon: -5.325 },
  Melilla: { lat: 35.292, lon: -2.938 },
  Guadalajara: { lat: 40.633, lon: -3.167 },
  Ávila: { lat: 40.657, lon: -4.7 },
  Segovia: { lat: 40.943, lon: -4.109 },
  Soria: { lat: 41.764, lon: -2.465 },
  Zamora: { lat: 41.504, lon: -5.745 },
  Palencia: { lat: 42.01, lon: -4.528 },
  'Ciudad Real': { lat: 38.986, lon: -3.927 },
  Cuenca: { lat: 40.07, lon: -2.137 },
  Teruel: { lat: 40.344, lon: -1.107 },
  Huesca: { lat: 42.132, lon: -0.409 },
  Vitoria: { lat: 42.847, lon: -2.673 },
  'Vitoria-Gasteiz': { lat: 42.847, lon: -2.673 },
  // Municipios españoles que no son capital pero salen en el informe: los grandes por
  // población. La lista creció con datos reales (Algeciras, Castelldefels).
  Algeciras: { lat: 36.128, lon: -5.453 },
  Castelldefels: { lat: 41.28, lon: 1.977 },
  'L\'Hospitalet de Llobregat': { lat: 41.36, lon: 2.1 },
  Badalona: { lat: 41.45, lon: 2.247 },
  Terrassa: { lat: 41.564, lon: 2.011 },
  Sabadell: { lat: 41.543, lon: 2.109 },
  Mataró: { lat: 41.54, lon: 2.445 },
  'Santa Coloma de Gramenet': { lat: 41.451, lon: 2.208 },
  Cornellá: { lat: 41.355, lon: 2.071 },
  'Sant Cugat del Vallès': { lat: 41.472, lon: 2.086 },
  Manresa: { lat: 41.726, lon: 1.827 },
  Reus: { lat: 41.155, lon: 1.107 },
  Móstoles: { lat: 40.323, lon: -3.865 },
  Alcalá: { lat: 40.482, lon: -3.364 },
  'Alcalá de Henares': { lat: 40.482, lon: -3.364 },
  Fuenlabrada: { lat: 40.284, lon: -3.794 },
  Leganés: { lat: 40.327, lon: -3.764 },
  Getafe: { lat: 40.308, lon: -3.733 },
  Alcorcón: { lat: 40.346, lon: -3.828 },
  'Torrejón de Ardoz': { lat: 40.456, lon: -3.479 },
  'Las Rozas de Madrid': { lat: 40.492, lon: -3.874 },
  'Pozuelo de Alarcón': { lat: 40.436, lon: -3.813 },
  'San Sebastián de los Reyes': { lat: 40.548, lon: -3.626 },
  Getxo: { lat: 43.356, lon: -3.011 },
  Barakaldo: { lat: 43.297, lon: -2.988 },
  Irún: { lat: 43.338, lon: -1.789 },
  Elche: { lat: 38.266, lon: -0.699 },
  Torrevieja: { lat: 37.978, lon: -0.682 },
  Benidorm: { lat: 38.534, lon: -0.131 },
  Orihuela: { lat: 38.085, lon: -0.945 },
  Marbella: { lat: 36.51, lon: -4.886 },
  Fuengirola: { lat: 36.539, lon: -4.625 },
  Torremolinos: { lat: 36.622, lon: -4.5 },
  Estepona: { lat: 36.427, lon: -5.147 },
  Mijas: { lat: 36.595, lon: -4.637 },
  Vélez: { lat: 36.783, lon: -4.102 },
  'Jerez de la Frontera': { lat: 36.686, lon: -6.136 },
  'San Fernando': { lat: 36.462, lon: -6.199 },
  'El Puerto de Santa María': { lat: 36.594, lon: -6.233 },
  'Chiclana de la Frontera': { lat: 36.419, lon: -6.146 },
  'Dos Hermanas': { lat: 37.283, lon: -5.922 },
  Utrera: { lat: 37.185, lon: -5.781 },
  'Alcalá de Guadaíra': { lat: 37.339, lon: -5.84 },
  Linares: { lat: 38.095, lon: -3.636 },
  'Roquetas de Mar': { lat: 36.764, lon: -2.615 },
  'El Ejido': { lat: 36.777, lon: -2.814 },
  Motril: { lat: 36.748, lon: -3.519 },
  Ferrol: { lat: 43.484, lon: -8.234 },
  // "Santiago" a secas no se mapea a Compostela: es ambiguo con Santiago de Chile.
  // Compostela va con su nombre completo.
  'Santiago de Compostela': { lat: 42.878, lon: -8.545 },
  Pontevedra: { lat: 42.431, lon: -8.644 },
  Avilés: { lat: 43.556, lon: -5.925 },
  Torrelavega: { lat: 43.349, lon: -4.05 },
  Talavera: { lat: 39.963, lon: -4.83 },
  'Talavera de la Reina': { lat: 39.963, lon: -4.83 },
  Arrecife: { lat: 28.963, lon: -13.548 },
  'Puerto del Rosario': { lat: 28.5, lon: -13.863 },
  'San Cristóbal de La Laguna': { lat: 28.487, lon: -16.316 },
  'La Laguna': { lat: 28.487, lon: -16.316 },
  Telde: { lat: 27.999, lon: -15.417 },
  'Arona': { lat: 28.099, lon: -16.681 },
  Ibiza: { lat: 38.909, lon: 1.433 },
  Manacor: { lat: 39.57, lon: 3.209 },
  Sagunto: { lat: 39.68, lon: -0.273 },
  Torrente: { lat: 39.437, lon: -0.466 },
  Gandía: { lat: 38.968, lon: -0.181 },
  Paterna: { lat: 39.503, lon: -0.441 },
  Lorca: { lat: 37.671, lon: -1.702 },
  Molina: { lat: 38.055, lon: -1.213 },
  Lisboa: { lat: 38.722, lon: -9.139 },
  Oporto: { lat: 41.158, lon: -8.629 },
  Londres: { lat: 51.507, lon: -0.128 },
  París: { lat: 48.857, lon: 2.352 },
  Berlín: { lat: 52.52, lon: 13.405 },
  Múnich: { lat: 48.135, lon: 11.582 },
  Roma: { lat: 41.903, lon: 12.496 },
  Milán: { lat: 45.464, lon: 9.19 },
  Ámsterdam: { lat: 52.368, lon: 4.904 },
  Bruselas: { lat: 50.851, lon: 4.352 },
  Dublín: { lat: 53.35, lon: -6.26 },
  Zúrich: { lat: 47.377, lon: 8.542 },
  Viena: { lat: 48.208, lon: 16.373 },
  Varsovia: { lat: 52.23, lon: 21.012 },
  Estocolmo: { lat: 59.329, lon: 18.069 },
  Copenhague: { lat: 55.677, lon: 12.569 },
  'Nueva York': { lat: 40.713, lon: -74.006 },
  'Los Ángeles': { lat: 34.052, lon: -118.244 },
  Chicago: { lat: 41.878, lon: -87.63 },
  Miami: { lat: 25.762, lon: -80.192 },
  'San Francisco': { lat: 37.775, lon: -122.419 },
  Toronto: { lat: 43.653, lon: -79.383 },
  'Ciudad de México': { lat: 19.433, lon: -99.133 },
  Monterrey: { lat: 25.687, lon: -100.316 },
  Bogotá: { lat: 4.711, lon: -74.072 },
  Medellín: { lat: 6.244, lon: -75.581 },
  Lima: { lat: -12.046, lon: -77.043 },
  Quito: { lat: -0.181, lon: -78.467 },
  Caracas: { lat: 10.481, lon: -66.904 },
  Santiago: { lat: -33.449, lon: -70.669 },
  'Buenos Aires': { lat: -34.604, lon: -58.382 },
  Montevideo: { lat: -34.902, lon: -56.164 },
  'São Paulo': { lat: -23.551, lon: -46.633 },
  'Río de Janeiro': { lat: -22.907, lon: -43.173 },
  Tokio: { lat: 35.69, lon: 139.692 },
  Pekín: { lat: 39.904, lon: 116.407 },
  Shanghái: { lat: 31.23, lon: 121.474 },
  Bombay: { lat: 19.076, lon: 72.878 },
  Sídney: { lat: -33.869, lon: 151.209 },
  Dubái: { lat: 25.205, lon: 55.271 },
}

/** Sin tildes y en minúsculas, para casar nombres con o sin acentuar. */
const clave = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const indice = (tabla: Record<string, Punto>) =>
  new Map(Object.entries(tabla).map(([nombre, p]) => [clave(nombre), p]))

const PAISES_IDX = indice(PAISES)
const CIUDADES_IDX = indice(CIUDADES)

/** Punto de un país por su nombre en español, o null si no está en la tabla. */
export const puntoDePais = (nombre: string): Punto | null =>
  PAISES_IDX.get(clave(nombre)) ?? null

/** Punto de una ciudad. GA a veces añade provincia ("Alcalá de Henares, Madrid"):
 *  se prueba tal cual y, si no, la parte anterior a la coma. */
export const puntoDeCiudad = (nombre: string): Punto | null => {
  const directo = CIUDADES_IDX.get(clave(nombre))
  if (directo) return directo
  const primera = nombre.split(',')[0]
  if (primera && primera !== nombre) return CIUDADES_IDX.get(clave(primera)) ?? null
  return null
}

/** Proyección equirectangular a coordenadas del SVG (viewBox 0 0 1000 500). La
 *  latitud se recorta a [-60, 84]: el mapa no dibuja la Antártida. */
export const proyectar = (
  { lat, lon }: Punto,
  ancho = 1000,
  alto = 500,
): { x: number; y: number } => {
  const recortada = Math.min(84, Math.max(-60, lat))
  return {
    x: ((lon + 180) / 360) * ancho,
    y: ((84 - recortada) / 144) * alto,
  }
}
