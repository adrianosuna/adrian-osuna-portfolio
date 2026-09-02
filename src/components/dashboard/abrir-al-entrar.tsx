'use client'

// Abre el alta rápida de movimiento al ENTRAR en la página, cuando la URL lo
// pide (`/app?nuevo=gasto`). Es lo que hace útil el acceso directo del icono de
// la app instalada: un toque y ya estás escribiendo el importe.
//
// No pinta nada. Vive aparte porque el inicio es un componente de servidor y
// esto necesita el contexto de las acciones rápidas (cliente).
import { useEffect, useRef } from 'react'
import { useAcciones } from '@/components/dashboard/acciones-rapidas'
import type { TipoMovimiento } from '@/lib/gastos'

export function AbrirAltaAlEntrar({ tipo }: { tipo: TipoMovimiento }) {
  const { abrirAlta } = useAcciones()
  // Una sola vez por montaje: si el modal se cierra, no debe reabrirse solo.
  const hecho = useRef(false)

  useEffect(() => {
    if (hecho.current) return
    hecho.current = true
    abrirAlta(tipo)
  }, [abrirAlta, tipo])

  return null
}
