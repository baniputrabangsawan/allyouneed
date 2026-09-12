import { Grid2X2, Menu, Monitor, Moon, Search, Sun, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CommandPalette } from '@/components/common/CommandPalette'
import { LanguageChoices, LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { isPro, useEntitlement } from '@/features/licensing/entitlement'
import { LocaleLink } from '@/i18n/link'
import { useT } from '@/i18n'
import {
  getThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '@/lib/storage/preferences'
import { applyThemePreference, themeIsDark } from '@/lib/theme'

const themes: readonly ThemePreference[] = ['light', 'dark', 'system']
const explorerSearch = { q: '', category: 'all', group: 'all' } as const
const primaryNav = [
  { key: 'tools', hash: 'all-tools' },
  { key: 'favorites', hash: 'favorites' },
  { key: 'recent', hash: 'recent' },
  { key: 'new', hash: 'new' },
] as const


export function AppHeader() {
  const copy = useT()
  const [theme, setTheme] = useState<ThemePreference>('system')
  const [menuOpen, setMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutLabel, setShortcutLabel] = useState('Ctrl K')
  const headerRef = useRef<HTMLElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const preference = getThemePreference()
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => {
      if (getThemePreference() === 'system') applyThemePreference('system')
    }
    setTheme(preference)
    applyThemePreference(preference)
    if (/Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent)) {
      setShortcutLabel('⌘ K')
    }
    systemTheme.addEventListener('change', updateSystemTheme)
    return () => systemTheme.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        return
      }
      if (event.defaultPrevented) return
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      const openDialog = document.querySelector('dialog[open]')
      if (openDialog && !openDialog.classList.contains('command-dialog')) return
      event.preventDefault()
      setMenuOpen(false)
      setPaletteOpen((open) => !open)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    const onScroll = () => {
      const scrolled = window.scrollY > 16
      header.classList.toggle('is-scrolled', scrolled)
      document.documentElement.classList.toggle('kits-scrolled', scrolled)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function cycleTheme() {
    const currentDark = themeIsDark(theme)
    let next: ThemePreference = currentDark ? 'light' : 'dark'
    for (let step = 1; step <= themes.length; step += 1) {
      const candidate = themes[(themes.indexOf(theme) + step) % themes.length]
      if (candidate && themeIsDark(candidate) !== currentDark) {
        next = candidate
        break
      }
    }
    setTheme(next)
    saveThemePreference(next)
    applyThemePreference(next)
  }

  const closeMenu = () => setMenuOpen(false)
  const navLabel = (key: (typeof primaryNav)[number]['key']) => copy.nav[key]

  return <>
    <header ref={headerRef} className="site-header">
      <div ref={innerRef} className="header-inner bg-background/70 backdrop-blur-xl border border-border/50 shadow-sm rounded-2xl md:rounded-full px-6 md:px-10">
        <LocaleLink to="/" className="brand" onClick={closeMenu}><span className="brand-mark"><Grid2X2 size={18} /></span>{copy.brand}</LocaleLink>
        <nav aria-label="Primary">{primaryNav.map((item) => <LocaleLink key={item.hash} className="transition-colors duration-200" to="/" search={explorerSearch} hash={item.hash} resetScroll={false}>{navLabel(item.key)}</LocaleLink>)}<LocaleLink className="transition-colors duration-200" to="/docs">{copy.nav.docs}</LocaleLink><LocaleLink className="transition-colors duration-200" to="/pricing">{copy.nav.pricing}</LocaleLink></nav>
        <div className="header-actions">
          <LicenseStatusLink />
          <button className="search-shortcut" type="button" onClick={() => setPaletteOpen(true)} aria-label={copy.nav.searchAria} aria-keyshortcuts="Control+K Meta+K">
            <Search size={16} aria-hidden="true" />
            {copy.nav.search}
            <kbd className="hidden sm:inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">{shortcutLabel}</kbd>
          </button>
          <LanguageSwitcher />
          <button className="icon-button" type="button" onClick={cycleTheme} aria-label={`${copy.nav.theme}: ${theme}`} title={`${copy.nav.theme}: ${theme}`}>
            <span className="theme-icons" aria-hidden="true">
              <Sun className="theme-icon-light" size={19} />
              <Moon className="theme-icon-dark" size={19} />
              <Monitor className="theme-icon-system" size={19} />
            </span>
          </button>
          <button className="icon-button mobile-menu" type="button" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? copy.nav.closeMenu : copy.nav.openMenu} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </div>
      {menuOpen && <><button className="mobile-menu-backdrop" type="button" aria-label={copy.nav.closeMenu} onClick={closeMenu} /><nav id="mobile-navigation" className="mobile-navigation" aria-label="Mobile primary">{primaryNav.map((item) => <LocaleLink key={item.hash} to="/" search={explorerSearch} hash={item.hash} resetScroll={false} onClick={closeMenu}>{navLabel(item.key)}</LocaleLink>)}<LocaleLink to="/docs" onClick={closeMenu}>{copy.nav.docs}</LocaleLink><LocaleLink to="/pricing" onClick={closeMenu}>{copy.nav.pricing}</LocaleLink><LocaleLink to="/license" onClick={closeMenu}>{copy.nav.proLicense}</LocaleLink><LanguageChoices onChoose={closeMenu} /><button type="button" onClick={() => { closeMenu(); setPaletteOpen(true) }}><Search size={17} /> {copy.nav.searchAria}</button></nav></>}
    </header>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
  </>
}

function LicenseStatusLink() {
  const copy = useT()
  const entitlement = useEntitlement()
  const entitled = isPro(entitlement.data)
  return (
    <LocaleLink className={`license-chip${entitled ? ' active' : ''}`} to="/license">
      {entitled ? copy.availability.pro : copy.nav.license}
    </LocaleLink>
  )
}
