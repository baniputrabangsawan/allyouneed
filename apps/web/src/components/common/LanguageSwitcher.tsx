import type { MouseEvent } from 'react'
import { Globe } from 'lucide-react'
import { useRouterState } from '@tanstack/react-router'
import { localeLabels, type Locale } from '@/i18n/config'
import { switchLocaleLocation, useLocale, useT } from '@/i18n'
import { useSwitchLocale } from '@/i18n/navigate'
import { saveKeepScroll } from '@/lib/motion/restore'

function useLanguageHref(next: Locale) {
  const location = useRouterState({ select: (state) => state.location })
  return switchLocaleLocation(next, {
    pathname: location.pathname,
    searchStr: location.searchStr || (typeof window !== 'undefined' ? window.location.search : ''),
    hash: '',
  })
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
}

export function LanguageSwitcher({ compact = true }: { compact?: boolean }) {
  const copy = useT()
  const locale = useLocale()
  const next: Locale = locale === 'en' ? 'id' : 'en'
  const href = useLanguageHref(next)
  const switchLocale = useSwitchLocale()


  return (
    <a
      className="language-switcher-button"
      href={href}
      lang={next}
      hrefLang={next}
      aria-label={`${copy.language.label}: ${localeLabels[next]}`}
      title={localeLabels[next]}
      onPointerDown={() => saveKeepScroll()}
      onMouseDown={() => saveKeepScroll()}
      onClickCapture={(event) => {
        if (isModifiedClick(event)) return
        event.preventDefault()
        event.stopPropagation()
        switchLocale(next, href)
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
  const switchLocale = useSwitchLocale()

  return (
    <div className="language-choices">
      <p>{copy.nav.language}</p>
      <a
        href={href}
        lang={next}
        hrefLang={next}
        aria-label={`${copy.language.label}: ${localeLabels[next]}`}
        onPointerDown={() => saveKeepScroll()}
        onMouseDown={() => saveKeepScroll()}
        onClickCapture={(event) => {
          if (isModifiedClick(event)) return
          event.preventDefault()
          event.stopPropagation()
          switchLocale(next, href)
          onChoose?.()
        }}
      >
        {localeLabels[next]}
      </a>
    </div>
  )
}
