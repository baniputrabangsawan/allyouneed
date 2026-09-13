import { createFileRoute } from '@tanstack/react-router'
import { GuidesHome } from '@/features/pages/GuidesPages'
import { marketingHead } from '@/features/seo/page-head'
import { getMessages } from '@/i18n'

export const Route = createFileRoute('/id/guides/')({
  head: () => {
    const copy = getMessages('id')
    return marketingHead('id', '/guides', `${copy.pages.guidesTitle} | Kits`, copy.pages.guidesLead)
  },
  component: GuidesHome,
})
