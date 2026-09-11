import { localeHtml, localeOg, type Locale } from './config'
import { localizedPath } from './path'

export function pageSeo(locale: Locale, path: string, title: string, description: string) {
  const canonical = localizedPath(locale, path)
  const en = localizedPath('en', path)
  const id = localizedPath('id', path)
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:locale', content: localeOg[locale] },
    ],
    links: [
      { rel: 'canonical', href: canonical },
      { rel: 'alternate', hrefLang: 'en', href: en },
      { rel: 'alternate', hrefLang: 'id', href: id },
      { rel: 'alternate', hrefLang: 'x-default', href: en },
    ],
  }
}

export function documentLang(locale: Locale) {
  return localeHtml[locale]
}
