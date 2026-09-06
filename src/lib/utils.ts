import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Normaliza texto para buscar: sin mayúsculas ni tildes ("cafe" encuentra
 *  "Café"). NFD separa la letra de su diacrítico y el reemplazo se lo lleva. */
export const sinAcentos = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

/**
 * "1 país" / "3 países". Para los nombres accesibles, que se leen en voz alta:
 * ahí un "1 países" canta más que en cualquier otro sitio, y la regla ya está
 * en CLAUDE.md. Vive aquí y no en cada componente porque ya había dos copias
 * (el mapa de visitas y las celdas del calendario).
 */
export const cuenta = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`
