import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Normaliza texto para buscar: sin mayúsculas ni tildes ("cafe" encuentra
 *  "Café"). NFD separa la letra de su diacrítico y el reemplazo se lo lleva. */
export const sinAcentos = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

/** "1 país" / "3 países", para los nombres accesibles que se leen en voz alta. */
export const cuenta = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`
