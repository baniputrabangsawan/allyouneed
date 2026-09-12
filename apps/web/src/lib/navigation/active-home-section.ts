import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { stripLocalePrefix } from '@/i18n'

export const homeSectionIds = ['recent', 'favorites', 'new', 'all-tools'] as const

export function activeHomeSection(
  sections: readonly { id: string; top: number }[],
  line: number,
) {
  let current: string | null = null
  for (const section of sections) {
    if (section.top <= line) current = section.id
  }
  return current
}



export function useActiveHomeSection() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const path = stripLocalePrefix(pathname)
  const onHome = path === '/' || path === ''
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (!onHome) {
      setActive(null)
      return
    }

    const update = () => {
      if (document.body.style.position === 'fixed') return
      const sections = homeSectionIds.flatMap((id) => {
        const node = document.getElementById(id)
        return node ? [{ id, top: node.getBoundingClientRect().top }] : []
      })
      setActive(activeHomeSection(sections, 140))
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    window.addEventListener('kits:sync-home-section', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('kits:sync-home-section', update)
    }
  }, [onHome])

  return onHome ? active : null
}
