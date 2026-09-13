import { createFileRoute } from '@tanstack/react-router'
import { ContactPage } from '@/features/pages/SitePages'
import { marketingHead } from '@/features/seo/page-head'
import { getMessages } from '@/i18n'

export const Route = createFileRoute('/id/contact')({
  head: () => {
    const copy = getMessages('id')
    return marketingHead('id', '/contact', `${copy.pages.contactTitle} | Kits`, copy.pages.contactLead)
  },
  component: ContactPage,
})
