'use client'

// Selector de pestaña del Panel en MÓVIL: las cinco pestañas no caben en una
// fila en 375px, y ni el scroll horizontal ni las dos filas quedaban bien; un
// desplegable (con el estilo del tema) lo resuelve en una línea. En escritorio
// se usan las pestañas normales (ver panel/page.tsx).
import { useRouter } from 'next/navigation'
import { SelectField } from '@/components/ui/fields'

export function PanelTabsMovil({
  tabs,
  activa,
}: {
  tabs: ReadonlyArray<{ id: string; label: string; href: string }>
  activa: string
}) {
  const router = useRouter()
  return (
    <SelectField
      ariaLabel="Sección del Panel de control"
      value={activa}
      onChange={(v) => {
        const t = tabs.find((x) => x.id === v)
        if (t) router.push(t.href)
      }}
      options={tabs.map((t) => ({ value: t.id, label: t.label }))}
    />
  )
}
