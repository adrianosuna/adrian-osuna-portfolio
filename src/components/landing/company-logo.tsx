'use client'

// Logo de empresa: la imagen si carga; si falla, un monograma con las iniciales.
// Isla cliente solo por el `onError`.
import { useState } from 'react'
import Image from 'next/image'

export function CompanyLogo({ name, src }: { name: string; src: string }) {
  const [err, setErr] = useState(false)
  const initials = name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
  return (
    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-logo-box">
      {src && !err ? (
        <Image src={src} alt={name} width={48} height={48} className="size-full object-contain p-1.5" onError={() => setErr(true)} />
      ) : (
        <span className="text-base font-bold text-primary">{initials}</span>
      )}
    </div>
  )
}
