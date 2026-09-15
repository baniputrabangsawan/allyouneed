export const PWA_DARK_BACKGROUND = '#111114'
export const PWA_LIGHT_BACKGROUND = '#f5f5fa'
export const SPLASH_STORAGE_KEY = 'kits:splash-shown'

type MediaQueryFn = (query: string) => { matches: boolean }

export function isStandaloneDisplay(
  media: MediaQueryFn | undefined,
  navigatorLike: { standalone?: boolean } | undefined,
): boolean {
  if (!media) return navigatorLike?.standalone === true
  return media('(display-mode: standalone)').matches
    || media('(display-mode: fullscreen)').matches
    || media('(display-mode: window-controls-overlay)').matches
    || navigatorLike?.standalone === true
}

export function shouldShowLaunchSplash(options: {
  media?: MediaQueryFn
  navigatorLike?: { standalone?: boolean }
  navigationType?: string
  alreadyShown?: boolean
}): boolean {
  if (options.alreadyShown) return false
  if (options.navigationType === 'back_forward') return false
  return isStandaloneDisplay(options.media, options.navigatorLike)
}

export function resolvedThemeBackground(dark: boolean) {
  return dark ? PWA_DARK_BACKGROUND : PWA_LIGHT_BACKGROUND
}

export type InstallStatus = 'hidden' | 'prompt' | 'ios' | 'installed'

export function isIosDevice(userAgent: string, platform: string, maxTouchPoints: number) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true
  return platform === 'MacIntel' && maxTouchPoints > 1
}

export function resolveInstallStatus(options: {
  standalone: boolean
  hasPrompt: boolean
  ios: boolean
}): InstallStatus {
  if (options.standalone) return 'installed'
  if (options.hasPrompt) return 'prompt'
  if (options.ios) return 'ios'
  return 'hidden'
}

export function registerKitsServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) void registration.unregister()
    })
    return
  }
  void navigator.serviceWorker.register('/sw.js')
}
