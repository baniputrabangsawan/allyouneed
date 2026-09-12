import { useRouterState } from '@tanstack/react-router'
import {
  BookOpen,
  Clock,
  Globe,
  Grid2X2,
  LayoutGrid,
  Moon,
  Search,
  Sparkles,
  Star,
  Sun,
  Tag,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useEntitlement } from '@/features/licensing/entitlement'
import { explorerSearch, pageNav, primaryNav } from '@/components/layout/primary-nav'
import { localeLabels, locales, type Locale } from '@/i18n/config'
import { LocaleLink } from '@/i18n/link'
import { stripLocalePrefix, switchLocaleLocation, useLocale, useT } from '@/i18n'
import { useGoHomeTop, useSwitchLocale } from '@/i18n/navigate'
import { gsap, useGSAP } from '@/lib/motion/gsap'
import { prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { themeIsDark } from '@/lib/theme'
import type { ThemePreference } from '@/lib/storage/preferences'

const hashIcons = {
  tools: LayoutGrid,
  favorites: Star,
  recent: Clock,
  new: Sparkles,
} as const

const pageIcons = {
  docs: BookOpen,
  pricing: Tag,
} as const

interface MobileNavProps {
  theme: ThemePreference
  shortcutLabel: string
  onClose: () => void
  onSearch: () => void
  onCycleTheme: () => void
}

export function MobileNav({ theme, shortcutLabel, onClose, onSearch, onCycleTheme }: MobileNavProps) {
  const copy = useT()
  const goHomeTop = useGoHomeTop()
  const locale = useLocale()
  const switchLocale = useSwitchLocale()
  const entitlement = useEntitlement()
  const entitled = entitlement.state === 'pro'
  const licensePending = entitlement.state === 'loading'
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const searchStr = useRouterState({ select: (state) => state.location.searchStr })
  const hash = useRouterState({ select: (state) => state.location.hash.replace(/^#/, '') })
  const path = stripLocalePrefix(pathname)
  const sheetRef = useRef<HTMLElement>(null)
  const backdropRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [langOpen, setLangOpen] = useState(false)
  const dark = typeof window !== 'undefined' && themeIsDark(theme)

  function close() {
    if (prefersReducedMotion() || !sheetRef.current) {
      onClose()
      return
    }
    gsap.to([backdropRef.current, sheetRef.current], {
      opacity: 0,
      duration: 0.18,
      ease: 'power2.in',
      onComplete: onClose,
    })
  }

  useGSAP(() => {
    if (prefersReducedMotion()) return
    const sheet = sheetRef.current
    if (!sheet) return
    gsap.from(backdropRef.current, { opacity: 0, duration: 0.18, ease: 'power2.out' })
    gsap.from(sheet, { x: 16, opacity: 0, duration: 0.24, ease: 'power2.out' })
    gsap.from(sheet.querySelectorAll('.mobile-sheet-header, .mobile-sheet-label, .mobile-sheet-row, .mobile-sheet-search'), {
      y: 4,
      opacity: 0,
      duration: 0.2,
      stagger: 0.012,
      delay: 0.03,
      ease: 'power2.out',
    })
  }, { scope: sheetRef })

  useEffect(() => {
    const body = document.body
    const html = document.documentElement
    const previousBody = body.style.overflow
    const previousHtml = html.style.overflow
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
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
    return () => {
      body.style.overflow = previousBody
      html.style.overflow = previousHtml
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function pathActive(to: string) {
    if (to === '/docs') return path === '/docs' || path.startsWith('/docs/')
    return path === to
  }

  function hashActive(itemHash: string) {
    return (path === '/' || path === '') && hash === itemHash
  }

  function pickLocale(next: Locale) {
    if (next === locale) return
    switchLocale(next, switchLocaleLocation(next, { pathname, searchStr, hash: '' }))
    close()
  }

  return (
    <>
      <button ref={backdropRef} className="mobile-menu-backdrop" type="button" aria-label={copy.nav.closeMenu} onClick={close} />
      <nav ref={sheetRef} id="mobile-navigation" className="mobile-sheet" aria-label="Mobile primary" aria-modal="true" role="dialog">
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
          {primaryNav.map((item) => {
            const Icon = hashIcons[item.key]
            return (
              <LocaleLink
                key={item.hash}
                className={`mobile-sheet-row${hashActive(item.hash) ? ' active' : ''}`}
                to="/"
                search={explorerSearch}
                hash={item.hash}
                resetScroll={false}
                onClick={close}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{copy.nav[item.key]}</span>
              </LocaleLink>
            )
          })}
          {pageNav.map((item) => {
            const Icon = pageIcons[item.key]
            return (
              <LocaleLink
                key={item.to}
                className={`mobile-sheet-row${pathActive(item.to) ? ' active' : ''}`}
                to={item.to}
                onClick={close}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{copy.nav[item.key]}</span>
              </LocaleLink>
            )
          })}

          <p className="mobile-sheet-label">{copy.nav.sectionPro}</p>
          {licensePending ? (
            <span className="mobile-sheet-row license-chip-loading" aria-busy="true" aria-label={copy.nav.proLicense}>
              <Sparkles size={18} aria-hidden="true" />
              <span />
            </span>
          ) : (
            <LocaleLink className={`mobile-sheet-row${pathActive('/license') ? ' active' : ''}`} to="/license" onClick={close}>
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
