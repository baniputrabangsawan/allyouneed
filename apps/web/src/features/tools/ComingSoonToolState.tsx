import { useRef } from 'react'
import {
  ArrowRight,
  AudioLines,
  Braces,
  FileText,
  Image,
  QrCode,
  RefreshCw,
  TextCursorInput,
  Video,
  WandSparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { LocaleLink } from '@/i18n/link'
import { useLocale, useT } from '@/i18n'
import { localizeTool, useLocalizedTool } from '@/i18n/tools'
import { gsap, useGSAP } from '@/lib/motion/gsap'
import { motion } from '@/lib/motion/config'
import { getRelatedTools, type ToolDefinition } from '@/features/tools/tool-registry'

const iconMap: Record<string, LucideIcon> = {
  Image,
  QrCode,
  FileText,
  AudioLines,
  Video,
  TextCursorInput,
  Braces,
  WandSparkles,
  RefreshCw,
}

export function ComingSoonToolState({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const locale = useLocale()
  const item = useLocalizedTool(tool)
  const related = getRelatedTools(tool)
  const Icon = iconMap[tool.icon] ?? Wrench
  const categoryLabel = copy.category[tool.category] ?? tool.category
  const rootRef = useRef<HTMLElement>(null)

  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(root, { autoAlpha: 1, y: 0, filter: 'none' })
    })
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ defaults: { ease: motion.ease.enter } })
      tl.fromTo(root, {
        autoAlpha: 0,
        y: 18,
        filter: `blur(${motion.blur.small}px)`,
      }, {
        autoAlpha: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: motion.duration.normal,
        clearProps: 'filter',
      })
      tl.from('.coming-soon-main > *', {
        autoAlpha: 0,
        y: 12,
        duration: motion.duration.fast,
        stagger: 0.05,
        clearProps: 'all',
      }, '-=0.22')
      tl.from('.coming-soon-aside', {
        autoAlpha: 0,
        y: 14,
        duration: motion.duration.fast,
        clearProps: 'all',
      }, '-=0.28')
      tl.from('.coming-soon-related a', {
        autoAlpha: 0,
        y: 8,
        duration: motion.duration.instant,
        stagger: 0.045,
        clearProps: 'all',
      }, '-=0.18')
      const glow = root.querySelector('.coming-soon-badge-glow')
      if (glow) {
        gsap.to(glow, {
          autoAlpha: 0.55,
          scale: 1.12,
          duration: 1.8,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        })
      }
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [tool.id] })

  return (
    <section ref={rootRef} className="coming-soon-state" aria-labelledby="coming-soon-title">
      <div className="coming-soon-main">
        <div className="coming-soon-topline">
          <span className={`coming-soon-icon tool-icon ${tool.category}`}>
            <Icon size={20} aria-hidden="true" />
          </span>
          <span className="coming-soon-badge">
            <span className="coming-soon-badge-glow" aria-hidden="true" />
            <span className="badge soon">{copy.availability.comingSoonBadge}</span>
          </span>
        </div>
        <p className="coming-soon-kicker">{copy.workspace.toolEyebrow(categoryLabel)}</p>
        <h2 id="coming-soon-title">{item.name}</h2>
        <p className="coming-soon-lead">{copy.workspace.comingSoonPrepared(item.name)}</p>
        <p className="coming-soon-copy">{copy.workspace.comingSoonUpdate}</p>
        <LocaleLink className="button primary coming-soon-cta" to="/tools">
          {copy.workspace.exploreOtherTools}
          <ArrowRight size={16} aria-hidden="true" />
        </LocaleLink>
        <ComingSoonMark />
      </div>
      <aside className="coming-soon-aside">
        <p>{copy.workspace.youCanUseNow}</p>
        {related.length > 0 ? (
          <ul className="coming-soon-related">
            {related.map((relatedTool) => {
              const relatedItem = localizeTool(relatedTool, locale)
              const RelatedIcon = iconMap[relatedTool.icon] ?? Wrench
              return (
                <li key={relatedTool.id}>
                  <LocaleLink to="/$tool" params={{ tool: relatedTool.slug }}>
                    <span className={`tool-icon ${relatedTool.category}`}>
                      <RelatedIcon size={16} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{relatedItem.name}</strong>
                      <small>{relatedItem.shortDescription}</small>
                    </span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </LocaleLink>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="coming-soon-aside-empty">{copy.workspace.exploreOtherTools}</p>
        )}
      </aside>
    </section>
  )
}

function ComingSoonMark() {
  return (
    <svg className="coming-soon-mark" viewBox="0 0 280 132" fill="none" aria-hidden="true">
      <rect x="18" y="28" width="168" height="86" rx="18" stroke="currentColor" opacity="0.16" />
      <rect x="46" y="14" width="176" height="90" rx="18" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.28" />
      <path d="M70 86c18-22 36-22 54 0 18 22 36 22 54 0" stroke="currentColor" strokeWidth="1.5" opacity="0.28" />
      <circle cx="188" cy="44" r="16" stroke="currentColor" opacity="0.34" />
      <circle cx="188" cy="44" r="7" fill="currentColor" opacity="0.18" />
      <rect x="62" y="36" width="72" height="8" rx="4" fill="currentColor" opacity="0.14" />
      <rect x="62" y="50" width="48" height="6" rx="3" fill="currentColor" opacity="0.1" />
    </svg>
  )
}
