import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PWA_DARK_BACKGROUND, isIosDevice, resolveInstallStatus, shouldShowLaunchSplash } from './pwa'

describe('PWA launch splash', () => {
  it('only shows on installed-app display modes, not in a normal browser tab', () => {
    expect(shouldShowLaunchSplash({
      media: () => ({ matches: false }),
      navigatorLike: {},
    })).toBe(false)
    expect(shouldShowLaunchSplash({
      media: (query) => ({ matches: query === '(display-mode: standalone)' }),
      navigatorLike: {},
    })).toBe(true)
  })

  it('does not replay on back/forward or after it already ran this session', () => {
    expect(shouldShowLaunchSplash({
      media: () => ({ matches: true }),
      navigationType: 'back_forward',
    })).toBe(false)
    expect(shouldShowLaunchSplash({
      media: () => ({ matches: true }),
      alreadyShown: true,
    })).toBe(false)
  })
})

describe('install CTA availability', () => {
  it('hides the CTA in a normal browser tab without an install prompt', () => {
    expect(resolveInstallStatus({ standalone: false, hasPrompt: false, ios: false })).toBe('hidden')
  })

  it('shows the native prompt when Chromium can install, and iOS guidance otherwise', () => {
    expect(resolveInstallStatus({ standalone: false, hasPrompt: true, ios: false })).toBe('prompt')
    expect(resolveInstallStatus({ standalone: false, hasPrompt: false, ios: true })).toBe('ios')
    expect(resolveInstallStatus({ standalone: true, hasPrompt: true, ios: true })).toBe('installed')
  })

  it('treats iPhone and iPadOS as iOS', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0)).toBe(false)
  })
})

describe('site.webmanifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../public/site.webmanifest', import.meta.url), 'utf8')) as {
    name: string
    short_name: string
    display: string
    start_url: string
    theme_color: string
    background_color: string
    icons: { src: string; sizes: string; purpose?: string }[]
  }

  it('uses the dark app background so the OS splash does not flash light', () => {
    expect(manifest.name).toBe('Kits')
    expect(manifest.short_name).toBe('Kits')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.theme_color).toBe(PWA_DARK_BACKGROUND)
    expect(manifest.background_color).toBe(PWA_DARK_BACKGROUND)
  })

  it('includes any and maskable icons', () => {
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icon-192.png', sizes: '192x192' }),
      expect.objectContaining({ src: '/icon-512.png', sizes: '512x512' }),
      expect.objectContaining({ src: '/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' }),
    ]))
  })
})
