// @vitest-environment jsdom
// Landing pública: estructura de secciones, el modal del caso (abrir, cerrar,
// devolver el foco) y una auditoría axe de la página entera.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { auditar } from './axe'
import { CONTENT, PROFILE } from '@/lib/landing/content'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// next/image y next/link como etiquetas planas: aquí solo importa el DOM.
const SOLO_NEXT = ['fill', 'priority', 'quality', 'unoptimized', 'sizes']
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const limpios = Object.fromEntries(Object.entries(props).filter(([k]) => !SOLO_NEXT.includes(k)))
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(limpios as React.ImgHTMLAttributes<HTMLImageElement>)} />
  },
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { Landing } from '@/components/landing/landing'

afterEach(cleanup)

describe('Landing', () => {
  it('pinta el h1, las cinco secciones ancladas y las tres cifras', () => {
    render(<Landing />)
    expect(screen.getByRole('heading', { level: 1, name: PROFILE.name })).toBeTruthy()
    for (const id of ['proyectos', 'sobre-mi', 'como-trabajo', 'experiencia', 'contacto']) {
      expect(document.getElementById(id), id).toBeTruthy()
    }
    const cifras = document.querySelectorAll('main > section:nth-child(2) dd')
    expect(cifras).toHaveLength(3)
    expect(document.body.textContent).not.toContain('1.º')
  })

  it('cada proyecto es una tarjeta con «Leer el caso», y «Cómo trabajo» lista sus principios', () => {
    render(<Landing />)
    const proyectos = document.getElementById('proyectos')!
    expect(within(proyectos).getAllByRole('article')).toHaveLength(CONTENT.projects.length)
    expect(within(proyectos).getAllByRole('button', { name: CONTENT.caseLabels.open })).toHaveLength(CONTENT.projects.length)
    const principios = within(document.getElementById('como-trabajo')!).getAllByRole('listitem')
    expect(principios.map((li) => within(li).getByRole('heading', { level: 3 }).textContent)).toEqual(
      CONTENT.work.principles.map((p) => p.title),
    )
  })

  it('«Leer el caso» abre el modal con el caso completo; Escape lo cierra y devuelve el foco', () => {
    render(<Landing />)
    const [boton] = screen.getAllByRole('button', { name: CONTENT.caseLabels.open })
    boton.focus()
    fireEvent.click(boton)
    const dialogo = screen.getByRole('dialog', { name: CONTENT.projects[0].title })
    expect(within(dialogo).getByText(CONTENT.caseLabels.context)).toBeTruthy()
    expect(within(dialogo).getByText(CONTENT.projects[0].result)).toBeTruthy()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(boton)
  })

  it('pasa la auditoría axe entera', async () => {
    const { container } = render(<Landing />)
    expect(await auditar(container)).toEqual([])
  })
})
