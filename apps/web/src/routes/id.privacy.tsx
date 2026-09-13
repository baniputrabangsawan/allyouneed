import { createFileRoute } from '@tanstack/react-router'
import { PrivacyPolicyPage } from '@/features/pages/SitePages'
import { marketingHead } from '@/features/seo/page-head'
import { getMessages } from '@/i18n'

export const Route = createFileRoute('/id/privacy')({
  head: () => {
    const copy = getMessages('id')
    return marketingHead('id', '/privacy', `${copy.pages.privacyTitle} | Kits`, copy.pages.privacyLead)
  },
  component: PrivacyPolicyPage,
})
