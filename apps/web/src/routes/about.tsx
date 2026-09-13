import { createFileRoute } from '@tanstack/react-router'
import { AboutPage } from '@/features/pages/SitePages'
import { marketingHead } from '@/features/seo/page-head'
import { getMessages } from '@/i18n'

export const Route = createFileRoute('/about')({
  head: () => {
    const copy = getMessages('en')
    return marketingHead('en', '/about', `${copy.pages.aboutTitle} | Kits`, copy.pages.aboutLead)
  },
  component: AboutPage,
})
