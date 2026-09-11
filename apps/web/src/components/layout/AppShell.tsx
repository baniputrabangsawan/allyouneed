import { Link } from '@tanstack/react-router'
import { Grid2X2, Menu, Monitor, Moon, Search, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CommandPalette } from '@/components/common/CommandPalette'
import { isPro, useEntitlement } from '@/features/licensing/entitlement'
import {
  getThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '@/lib/storage/preferences'


const themes: readonly ThemePreference[] = ['light', 'dark', 'system']
const explorerSearch = { q: '', category: 'all', group: 'all' } as const
const primaryNav = [
  { label: 'Tools', hash: 'all-tools' },
  { label: 'Favorites', hash: 'favorites' },
  { label: 'Recent', hash: 'recent' },
  { label: 'New', hash: 'new' },
] as const

function themeIsDark(theme: ThemePreference) {
  return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

function applyTheme(theme: ThemePreference) {
  document.documentElement.classList.toggle('dark', themeIsDark(theme))
}

export function AppHeader() {
  const [theme, setTheme] = useState<ThemePreference>('system')
  const [menuOpen, setMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutLabel, setShortcutLabel] = useState('Ctrl K')
  const headerRef = useRef<HTMLElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const preference = getThemePreference()
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => {
      if (getThemePreference() === 'system') applyTheme('system')
    }
    setTheme(preference)
    applyTheme(preference)
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




  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 16)
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
    applyTheme(next)
  }

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const closeMenu = () => setMenuOpen(false)

  return <>
    <header ref={headerRef} className="site-header">
      <div ref={innerRef} className="header-inner bg-background/70 backdrop-blur-xl border border-border/50 shadow-sm rounded-2xl md:rounded-full px-6 md:px-10">
        <Link to="/" className="brand" onClick={closeMenu}><span className="brand-mark"><Grid2X2 size={18} /></span>Kits</Link>
        <nav aria-label="Primary">{primaryNav.map((item) => <Link key={item.hash} className="transition-colors duration-200" to="/" search={explorerSearch} hash={item.hash} resetScroll={false}>{item.label}</Link>)}<Link className="transition-colors duration-200" to="/pricing">Pricing</Link></nav>
        <div className="header-actions">
          <LicenseStatusLink />
          <button className="search-shortcut" type="button" onClick={() => setPaletteOpen(true)} aria-label="Search tools" aria-keyshortcuts="Control+K Meta+K">
            <Search size={16} aria-hidden="true" />
            Search
            <kbd className="hidden sm:inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">{shortcutLabel}</kbd>
          </button>
          <button className="icon-button" type="button" onClick={cycleTheme} aria-label={`Color theme: ${theme}. Toggle light and dark`} title={`Theme: ${theme}`}><ThemeIcon size={19} /></button>
          <button className="icon-button mobile-menu" type="button" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </div>
      {menuOpen && <><button className="mobile-menu-backdrop" type="button" aria-label="Close menu" onClick={closeMenu} /><nav id="mobile-navigation" className="mobile-navigation" aria-label="Mobile primary">{primaryNav.map((item) => <Link key={item.hash} to="/" search={explorerSearch} hash={item.hash} resetScroll={false} onClick={closeMenu}>{item.label}</Link>)}<Link to="/pricing" onClick={closeMenu}>Pricing</Link><Link to="/license" onClick={closeMenu}>Pro license</Link><button type="button" onClick={() => { closeMenu(); setPaletteOpen(true) }}><Search size={17} /> Search tools</button></nav></>}
    </header>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
  </>
}

function LicenseStatusLink() {
  const entitlement = useEntitlement()
  const entitled = isPro(entitlement.data)
  return (
    <Link className={`license-chip${entitled ? ' active' : ''}`} to="/license">
      {entitled ? 'Pro' : 'Activate Pro'}
    </Link>
  )
}

