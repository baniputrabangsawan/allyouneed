import { createFileRoute } from '@tanstack/react-router'
import { SupportPage } from '@/features/pages/SitePages'
import { marketingHead } from '@/features/seo/page-head'
import { getMessages } from '@/i18n'

export const Route = createFileRoute('/support')({
  head: () => {
    const copy = getMessages('en')
    return marketingHead('en', '/support', `${copy.pages.supportTitle} | Kits`, copy.pages.supportLead)
  },
  component: SupportPage,
})
