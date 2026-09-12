import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getThemePreference, saveThemePreference, type ThemePreference } from '@/lib/storage/preferences'
import { applyThemePreference } from '@/lib/theme'

const icons = { light: Sun, dark: Moon, system: Monitor }

export function ThemeSelect() {
  const [theme, setTheme] = useState<ThemePreference>('system')
  const Icon = icons[theme]

  useEffect(() => {
    const preference = getThemePreference()
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => {
      if (getThemePreference() === 'system') applyThemePreference('system')
    }
    setTheme(preference)
    applyThemePreference(preference)
    systemTheme.addEventListener('change', updateSystemTheme)
    return () => systemTheme.removeEventListener('change', updateSystemTheme)
  }, [])

  return (
    <label className="theme-select">
      <Icon size={17} />
      <span className="sr-only">Color theme</span>
      <select
        value={theme}
        onChange={(event) => {
          const next = event.target.value as ThemePreference
          setTheme(next)
          saveThemePreference(next)
          applyThemePreference(next)
        }}
        aria-label="Color theme"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </label>
  )
}
