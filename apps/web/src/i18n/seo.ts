import { localeHtml, localeOg, type Locale } from './config'
import { localizedPath } from './path'
import { absoluteUrl } from '@/features/seo/site'

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
      { rel: 'canonical', href: absoluteUrl(canonical) },
      { rel: 'alternate', hrefLang: 'en', href: absoluteUrl(en) },
      { rel: 'alternate', hrefLang: 'id', href: absoluteUrl(id) },
      { rel: 'alternate', hrefLang: 'x-default', href: absoluteUrl(en) },
    ],
  }
}

export function documentLang(locale: Locale) {
  return localeHtml[locale]
}
