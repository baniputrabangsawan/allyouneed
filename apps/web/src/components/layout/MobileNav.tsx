import { useRouterState } from '@tanstack/react-router'
import {
  BookOpen,
  CircleHelp,
  Globe,
  Grid2X2,
  Home,
  LayoutGrid,
  Moon,
  Search,
  Sparkles,
  Sun,
  Tag,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useEntitlement } from '@/features/licensing/entitlement'
import { isPrimaryNavActive, primaryNavigation } from '@/components/layout/primary-nav'
import { InstallKitsCTA } from '@/components/common/InstallKitsCTA'
import { localeLabels, locales, type Locale } from '@/i18n/config'
import { LocaleLink } from '@/i18n/link'
import { stripLocalePrefix, switchLocaleLocation, useLocale, useT } from '@/i18n'
import { useGoHomeTop, useSwitchLocale } from '@/i18n/navigate'
import { gsap, useGSAP } from '@/lib/motion/gsap'
import { motion } from '@/lib/motion/config'
import { prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { themeIsDark } from '@/lib/theme'
import type { ThemePreference } from '@/lib/storage/preferences'

const pageIcons = {
  home: Home,
  tools: LayoutGrid,
  guides: BookOpen,
  about: CircleHelp,
  pricing: Tag,
  support: CircleHelp,
} as const

interface MobileNavProps {
  theme: ThemePreference
  shortcutLabel: string
  onClose: () => void
  onSearch: () => void
  onCycleTheme: () => void
  closeRef?: { current: (() => void) | null }
}

export function MobileNav({ theme, shortcutLabel, onClose, onSearch, onCycleTheme, closeRef: closeHandle }: MobileNavProps) {
  const copy = useT()
  const goHomeTop = useGoHomeTop()
  const locale = useLocale()
  const switchLocale = useSwitchLocale()
  const entitlement = useEntitlement()
  const entitled = entitlement.state === 'pro'
  const licensePending = entitlement.state === 'loading'
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const searchStr = useRouterState({ select: (state) => state.location.searchStr })
  const path = stripLocalePrefix(pathname)
  const sheetRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const closing = useRef(false)
  const [langOpen, setLangOpen] = useState(false)
  const dark = typeof window !== 'undefined' && themeIsDark(theme)

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    if (prefersReducedMotion() || !sheetRef.current) {
      onClose()
      return
    }
    gsap.to(backdropRef.current, { opacity: 0, duration: motion.duration.instant, ease: motion.ease.exit })
    gsap.to(sheetRef.current, {
      x: 28,
      opacity: 0,
      duration: motion.duration.fast,
      ease: motion.ease.exit,
      onComplete: onClose,
    })
  }, [onClose])

  useEffect(() => {
    if (!closeHandle) return
    closeHandle.current = close
    return () => {
      closeHandle.current = null
    }
  }, [closeHandle, close])

  useGSAP(() => {
    if (prefersReducedMotion()) return
    const sheet = sheetRef.current
    if (!sheet) return
    gsap.from(backdropRef.current, { opacity: 0, duration: motion.duration.instant, ease: motion.ease.enter })
    gsap.from(sheet, { x: 28, opacity: 0, duration: motion.duration.fast, ease: motion.ease.enter })
    gsap.from(sheet.querySelectorAll('.mobile-sheet-header, .mobile-sheet-label, .mobile-sheet-row, .mobile-sheet-search'), {
      y: 4,
      opacity: 0,
      duration: motion.duration.instant,
      stagger: 0.012,
      delay: 0.03,
      ease: motion.ease.enter,
    })
  }, { scope: sheetRef })

  useLayoutEffect(() => {
    const body = document.body
    const y = window.scrollY
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    }
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.width = '100%'
    closeRef.current?.focus()
    return () => {
      body.style.overflow = previous.overflow
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.width = previous.width
      window.scrollTo({ top: y, left: 0, behavior: 'instant' })
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
        return
      }
      const sheet = sheetRef.current
      if (event.key !== 'Tab' || !sheet) return
      const focusable = [...sheet.querySelectorAll<HTMLElement>('a,button,select,[href],[tabindex]:not([tabindex="-1"])')]
        .filter((node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true')
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  function pickLocale(next: Locale) {
    if (next === locale) return
    switchLocale(next, switchLocaleLocation(next, { pathname, searchStr, hash: '' }))
    close()
  }

  return (
    <>
      <button ref={backdropRef} className="mobile-menu-backdrop" type="button" aria-label={copy.nav.closeMenu} onClick={close} />
      <nav ref={sheetRef} id="mobile-navigation" className="mobile-sheet" aria-modal="true" aria-label="Mobile primary" role="dialog">
        <div className="mobile-sheet-header">
          <LocaleLink to="/" className="brand" onClick={(event) => { close(); goHomeTop(event) }}>
            <span className="brand-mark"><Grid2X2 size={18} /></span>
            {copy.brand}
          </LocaleLink>
          <button ref={closeRef} className="mobile-sheet-close" type="button" aria-label={copy.nav.closeMenu} onClick={close}>
            <X size={18} />
          </button>
        </div>

        <div className="mobile-sheet-body">
          <p className="mobile-sheet-label">{copy.nav.sectionNav}</p>
          {primaryNavigation.map((item) => {
            const Icon = pageIcons[item.key]
            const active = isPrimaryNavActive(item.to, path)
            return (
              <LocaleLink
                key={item.key}
                className={`mobile-sheet-row${active ? ' active' : ''}`}
                activeProps={{ className: '' }}
                aria-current={active ? 'page' : undefined}
                to={item.to}
                onClick={item.key === 'home' ? (event) => { close(); goHomeTop(event) } : close}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{copy.nav[item.key]}</span>
              </LocaleLink>
            )
          })}

          <InstallKitsCTA variant="row" />


          <p className="mobile-sheet-label">{copy.nav.sectionPro}</p>
          {licensePending ? (
            <span className="mobile-sheet-row license-chip-loading" aria-busy="true" aria-label={copy.nav.proLicense}>
              <Sparkles size={18} aria-hidden="true" />
              <span />
            </span>
          ) : (
            <LocaleLink className={`mobile-sheet-row${path === '/license' ? ' active' : ''}`} to="/license" onClick={close}>
              <Sparkles size={18} aria-hidden="true" />
              <span>{entitled ? copy.nav.managePro : copy.nav.license}</span>
            </LocaleLink>
          )}
          <p className="mobile-sheet-label">{copy.nav.sectionPreferences}</p>
          <button className="mobile-sheet-row" type="button" onClick={() => setLangOpen((open) => !open)}>
            <Globe size={18} aria-hidden="true" />
            <span>{copy.nav.language}</span>
            <span className="mobile-sheet-meta">{locale === 'id' ? copy.language.closedId : copy.language.closedEn}</span>
          </button>
          {langOpen && (
            <div className="mobile-sheet-langs">
              {locales.map((item) => (
                <button
                  key={item}
                  className={`mobile-sheet-lang${item === locale ? ' active' : ''}`}
                  type="button"
                  lang={item}
                  onClick={() => pickLocale(item)}
                >
                  {localeLabels[item]}
                </button>
              ))}
            </div>
          )}
          <button className="mobile-sheet-row" type="button" onClick={onCycleTheme}>
            {dark ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
            <span>{copy.nav.appearance}</span>
            <span className="mobile-sheet-meta">{copy.theme[theme]}</span>
          </button>
        </div>

        <button
          className="mobile-sheet-search"
          type="button"
          onClick={() => { close(); onSearch() }}
        >
          <Search size={18} aria-hidden="true" />
          <span>{copy.nav.searchAria}</span>
          <kbd>{shortcutLabel}</kbd>
        </button>
      </nav>
    </>
  )
}
