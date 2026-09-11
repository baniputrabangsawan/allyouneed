import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getThemePreference, saveThemePreference, type ThemePreference } from '@/lib/storage/preferences'

const icons = { light: Sun, dark: Moon, system: Monitor }

function applyTheme(theme: ThemePreference) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeSelect() {
  const [theme, setTheme] = useState<ThemePreference>('system')
  const Icon = icons[theme]

  useEffect(() => {
    const preference = getThemePreference()
    setTheme(preference)
    applyTheme(preference)
    const media = matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => { if (getThemePreference() === 'system') applyTheme('system') }
    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  return <label className="theme-select"><Icon size={17}/><span className="sr-only">Color theme</span><select value={theme} onChange={(event) => {
    const next = event.target.value as ThemePreference
    setTheme(next)
    saveThemePreference(next)
    applyTheme(next)
  }} aria-label="Color theme"><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label>
}
