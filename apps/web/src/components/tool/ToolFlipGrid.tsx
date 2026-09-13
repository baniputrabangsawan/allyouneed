import { memo, useLayoutEffect, useRef, useState } from 'react'
import { DiscoveryToolCard } from '@/components/common/DiscoveryToolCard'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import { useT } from '@/i18n'
import { animateEnteringCards, cardExitVars } from '@/lib/motion/cards'
import { motion } from '@/lib/motion/config'
import { itemSignature } from '@/lib/motion/flip-grid'
import { Flip, ScrollTrigger, gsap, registerMotion } from '@/lib/motion/gsap'
import { isCompactMotion, prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { isRestoringNavigation } from '@/lib/motion/restore'
import { batchRevealCards } from '@/lib/motion/scroll'

function idOf(tool: ToolDefinition) {
  return tool.id
}

function useFlipItems(next: readonly ToolDefinition[], animate = true) {
  const [rendered, setRendered] = useState<ToolDefinition[]>(() => [...next])
  const scopeRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<Flip.FlipState | null>(null)
  const bootedRef = useRef(false)
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
    if (!animate || prefersReducedMotion() || isCompactMotion() || !root || renderedRef.current.length === 0) {
      if (root) {
        const cards = root.querySelectorAll('[data-flip-id]')
        gsap.killTweensOf(cards)
        Flip.killFlipsOf(cards)
      }
      stateRef.current = null
      setRendered([...upcoming])
      return
    }
    const cards = root.querySelectorAll('[data-flip-id]')
    gsap.killTweensOf(cards)
    Flip.killFlipsOf(cards)
    ScrollTrigger.getAll().forEach((trigger) => {
      if (trigger.trigger && root.contains(trigger.trigger)) trigger.kill()
    })
    gsap.set(cards, { clearProps: 'opacity,visibility,transform,filter' })
    stateRef.current = Flip.getState(cards)
    setRendered([...upcoming])
  }, [signature, animate])

  useLayoutEffect(() => {
    const root = scopeRef.current
    const state = stateRef.current
    if (!root || !state) return
    stateRef.current = null
    Flip.from(state, {
      duration: motion.duration.normal,
      ease: motion.ease.layout,
      absolute: true,
      absoluteOnLeave: true,
      nested: true,
      prune: true,
      scale: false,
      onEnter: (elements) => animateEnteringCards(gsap.utils.toArray<Element>(elements)),
      onLeave: (elements) => gsap.to(elements, cardExitVars()),
    })
  }, [rendered])

  useLayoutEffect(() => {
    const root = scopeRef.current
    if (!root || bootedRef.current) return
    const cards = root.querySelectorAll('[data-flip-id]')
    if (!cards.length) return
    bootedRef.current = true
    if (!animate || root.closest('.discovery-personal') || isRestoringNavigation() || isCompactMotion()) return
    batchRevealCards(cards)
  }, [signature, animate])

  return { scopeRef, rendered: animate ? rendered : next }
}

export const ToolFlipGrid = memo(function ToolFlipGrid({ items, animate = true }: { items: readonly ToolDefinition[]; animate?: boolean }) {
  const { scopeRef, rendered } = useFlipItems(items, animate)
  return (
    <div ref={scopeRef} className="tool-grid tool-flip-scope">
      {rendered.map((tool) => (
        <DiscoveryToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  )
})

export const AvailabilityFlipGrids = memo(function AvailabilityFlipGrids({
  available,
  comingSoon,
  animate = true,
}: {
  available: readonly ToolDefinition[]
  comingSoon: readonly ToolDefinition[]
  animate?: boolean
}) {
  const copy = useT()
  const { scopeRef, rendered } = useFlipItems([...available, ...comingSoon], animate)
  const shownAvailable = rendered.filter((tool) => tool.available)
  const shownSoon = rendered.filter((tool) => !tool.available)
  return (
    <div ref={scopeRef} className="tool-flip-scope">
      {shownAvailable.length > 0 && (
        <div className="tool-availability-group">
          <p className="eyebrow">{copy.availability.available}</p>
          <div className="tool-grid">
            {shownAvailable.map((tool) => (
              <DiscoveryToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      )}
      {shownSoon.length > 0 && (
        <div className="tool-availability-group">
          <p className="eyebrow">{copy.availability.comingSoon}</p>
          <div className="tool-grid">
            {shownSoon.map((tool) => (
              <DiscoveryToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
