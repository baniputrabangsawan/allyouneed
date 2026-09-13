import { createFileRoute } from '@tanstack/react-router'
import { PrivacyPolicyPage } from '@/features/pages/SitePages'
import { marketingHead } from '@/features/seo/page-head'
import { getMessages } from '@/i18n'

export const Route = createFileRoute('/privacy')({
  head: () => {
    const copy = getMessages('en')
    return marketingHead('en', '/privacy', `${copy.pages.privacyTitle} | Kits`, copy.pages.privacyLead)
  },
  component: PrivacyPolicyPage,
})
