import { createFileRoute } from '@tanstack/react-router'
import { TermsPage } from '@/features/pages/SitePages'
import { marketingHead } from '@/features/seo/page-head'
import { getMessages } from '@/i18n'

export const Route = createFileRoute('/terms')({
  head: () => {
    const copy = getMessages('en')
    return marketingHead('en', '/terms', `${copy.pages.termsTitle} | Kits`, copy.pages.termsLead)
  },
  component: TermsPage,
})
