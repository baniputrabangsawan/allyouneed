import { useEffect, useState } from 'react'
import {
  isIosDevice,
  isStandaloneDisplay,
  registerKitsServiceWorker,
  resolveInstallStatus,
  type InstallStatus,
} from '@/lib/pwa'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const subscribers = new Set<() => void>()

function notify() {
  subscribers.forEach((listener) => listener())
}

function onBeforeInstall(event: Event) {
  event.preventDefault()
  deferredPrompt = event as BeforeInstallPromptEvent
  notify()
}

function onAppInstalled() {
  deferredPrompt = null
  installed = true
  notify()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', onBeforeInstall)
  window.addEventListener('appinstalled', onAppInstalled)
}

export function useInstallPrompt() {
  const [, setVersion] = useState(0)
  const [iosHelp, setIosHelp] = useState(false)

  useEffect(() => {
    registerKitsServiceWorker()
    const refresh = () => setVersion((value) => value + 1)
    subscribers.add(refresh)
    return () => { subscribers.delete(refresh) }
  }, [])

  const standalone = typeof window !== 'undefined' && isStandaloneDisplay(
    (query) => window.matchMedia(query),
    window.navigator as { standalone?: boolean },
  )
  const ios = typeof window !== 'undefined' && isIosDevice(
    window.navigator.userAgent,
    window.navigator.platform,
    window.navigator.maxTouchPoints,
  )
  const status: InstallStatus = resolveInstallStatus({
    standalone: standalone || installed,
    hasPrompt: Boolean(deferredPrompt),
    ios,
  })

  async function promptInstall() {
    const event = deferredPrompt
    if (!event) return 'unavailable' as const
    deferredPrompt = null
    notify()
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'accepted') installed = true
    notify()
    return choice.outcome
  }

  return { status, iosHelp, setIosHelp, promptInstall }
}
