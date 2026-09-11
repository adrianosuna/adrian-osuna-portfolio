'use client'

// Selector de pestaña del Panel en móvil: cinco pestañas no caben en 375 px, así
// que van en un desplegable. El feedback de carga lo da la barra global.
import { useRouter } from 'next/navigation'
import { SelectField } from '@/components/ui/fields'
import { useCarga } from '@/components/dashboard/barra-carga'

export function PanelTabsMovil({
  tabs,
  activa,
}: {
  tabs: ReadonlyArray<{ id: string; label: string; href: string }>
  activa: string
}) {
  const router = useRouter()
  const iniciar = useCarga()
  return (
    <SelectField
      ariaLabel="Sección del Panel de control"
      value={activa}
      onChange={(v) => {
        const t = tabs.find((x) => x.id === v)
        if (!t || v === activa) return
        iniciar()
        router.push(t.href)
      }}
      options={tabs.map((t) => ({ value: t.id, label: t.label }))}
    />
  )
}
