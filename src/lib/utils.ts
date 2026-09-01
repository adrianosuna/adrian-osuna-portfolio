import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Normaliza texto para buscar: sin mayúsculas ni tildes ("cafe" encuentra
 *  "Café"). NFD separa la letra de su diacrítico y el reemplazo se lo lleva. */
export const sinAcentos = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
