import { Globe } from 'lucide-react'
import { useRouterState } from '@tanstack/react-router'
import { localeLabels, localeStorageKey, type Locale } from '@/i18n/config'
import { switchLocaleLocation, useLocale, useT } from '@/i18n'

function useLanguageHref(next: Locale) {
  const location = useRouterState({ select: (state) => state.location })
  return switchLocaleLocation(next, {
    pathname: location.pathname,
    searchStr: location.searchStr || (typeof window !== 'undefined' ? window.location.search : ''),
    hash: (typeof window !== 'undefined' && window.location.hash) || location.hash,
  })
}

export function LanguageSwitcher({ compact = true }: { compact?: boolean }) {
  const copy = useT()
  const locale = useLocale()
  const next: Locale = locale === 'en' ? 'id' : 'en'
  const href = useLanguageHref(next)

  return (
    <a
      className="language-switcher-button"
      href={href}
      lang={next}
      hrefLang={next}
      aria-label={`${copy.language.label}: ${localeLabels[next]}`}
      title={localeLabels[next]}
      onClick={() => {
        try { window.localStorage.setItem(localeStorageKey, next) } catch { /* ignore */ }
      }}
    >
      <Globe size={16} aria-hidden="true" />
      <span>{compact ? (locale === 'id' ? copy.language.closedId : copy.language.closedEn) : localeLabels[locale]}</span>
    </a>
  )
}

export function LanguageChoices({ onChoose }: { onChoose?: () => void }) {
  const copy = useT()
  const locale = useLocale()
  const next: Locale = locale === 'en' ? 'id' : 'en'
  const href = useLanguageHref(next)

  return (
    <div className="language-choices">
      <p>{copy.nav.language}</p>
      <a
        href={href}
        lang={next}
        hrefLang={next}
        aria-label={`${copy.language.label}: ${localeLabels[next]}`}
        onClick={() => {
          try { window.localStorage.setItem(localeStorageKey, next) } catch { /* ignore */ }
          onChoose?.()
        }}
      >
        {localeLabels[next]}
      </a>
    </div>
  )
}
