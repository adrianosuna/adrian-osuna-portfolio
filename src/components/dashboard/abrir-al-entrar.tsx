'use client'

// Abre el alta rápida al entrar cuando la URL lo pide (`/app?nuevo=gasto`), para el
// acceso directo de la app instalada. No pinta nada; necesita el contexto cliente.
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
