import { absoluteUrl, seoImage } from './site'
import { localeOg, type Locale } from '@/i18n/config'
import { localizedPath } from '@/i18n/path'

export function marketingHead(locale: Locale, path: string, title: string, description: string) {
  const canonical = absoluteUrl(localizedPath(locale, path))
  const en = absoluteUrl(localizedPath('en', path))
  const id = absoluteUrl(localizedPath('id', path))
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonical },
      { property: 'og:image', content: seoImage() },
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
