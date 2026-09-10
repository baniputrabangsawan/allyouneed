import { useLayoutEffect, useRef, useState } from 'react'
import { DiscoveryToolCard } from '@/components/common/DiscoveryToolCard'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import { cardEnterVars, cardExitVars, comingSoonEnterVars } from '@/lib/motion/cards'
import { motion } from '@/lib/motion/config'
import { itemSignature } from '@/lib/motion/flip-grid'
import { Flip, gsap, registerMotion } from '@/lib/motion/gsap'
import { prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'

function idOf(tool: ToolDefinition) {
  return tool.id
}

function useFlipItems(next: readonly ToolDefinition[]) {
  const [rendered, setRendered] = useState<ToolDefinition[]>(() => [...next])
  const scopeRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<Flip.FlipState | null>(null)
  const renderedRef = useRef(rendered)
  const nextRef = useRef(next)
  renderedRef.current = rendered
  nextRef.current = next
  const signature = itemSignature(next, idOf)

  useLayoutEffect(() => {
    registerMotion()
    const upcoming = nextRef.current
    if (itemSignature(renderedRef.current, idOf) === signature) return
    const root = scopeRef.current
    if (prefersReducedMotion() || !root) {
      setRendered([...upcoming])
      return
    }
    const cards = root.querySelectorAll('[data-flip-id]')
    gsap.killTweensOf(cards)
    Flip.killFlipsOf(cards)
    stateRef.current = Flip.getState(cards)
    setRendered([...upcoming])
  }, [signature])

  useLayoutEffect(() => {
    const root = scopeRef.current
    const state = stateRef.current
    if (!root || !state) return
    stateRef.current = null
    const enter = cardEnterVars()
    const leave = cardExitVars()
    Flip.from(state, {
      duration: motion.duration.normal,
      ease: motion.ease.layout,
      absolute: true,
      absoluteOnLeave: true,
      nested: true,
      prune: true,
      scale: false,
      onEnter: (elements) => {
        const list = gsap.utils.toArray<Element>(elements)
        const comingSoon = list.filter((element) => element.querySelector('.tool-card.disabled'))
        const available = list.filter((element) => !comingSoon.includes(element))
        if (available.length) {
          gsap.fromTo(available, { autoAlpha: 0, scale: enter.from.scale, filter: enter.from.filter }, {
            autoAlpha: 1,
            scale: 1,
            filter: 'blur(0px)',
            duration: enter.to.duration,
            stagger: enter.to.stagger,
            ease: motion.ease.enter,
            clearProps: 'filter',
          })
        }
        if (comingSoon.length) {
          const soon = comingSoonEnterVars()
          gsap.fromTo(comingSoon, soon.from, soon.to)
        }
      },
      onLeave: (elements) => gsap.to(elements, leave),
    })
  }, [rendered])

  return { scopeRef, rendered }
}

export function ToolFlipGrid({ items }: { items: readonly ToolDefinition[] }) {
  const { scopeRef, rendered } = useFlipItems(items)
  return (
    <div ref={scopeRef} className="tool-grid tool-flip-scope">
      {rendered.map((tool) => (
        <DiscoveryToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  )
}

export function AvailabilityFlipGrids({
  available,
  comingSoon,
}: {
  available: readonly ToolDefinition[]
  comingSoon: readonly ToolDefinition[]
}) {
  const { scopeRef, rendered } = useFlipItems([...available, ...comingSoon])
  const shownAvailable = rendered.filter((tool) => tool.available)
  const shownSoon = rendered.filter((tool) => !tool.available)
  return (
    <div ref={scopeRef} className="tool-flip-scope">
      {shownAvailable.length > 0 && (
        <div className="tool-availability-group">
          <p className="eyebrow">Available</p>
          <div className="tool-grid">
            {shownAvailable.map((tool) => (
              <DiscoveryToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      )}
      {shownSoon.length > 0 && (
        <div className="tool-availability-group">
          <p className="eyebrow">Coming soon</p>
          <div className="tool-grid">
            {shownSoon.map((tool) => (
              <DiscoveryToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
