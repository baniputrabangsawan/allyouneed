import { createFileRoute } from '@tanstack/react-router'
import { TroubleshootingDocs } from '@/features/docs/pages'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'

export const Route = createFileRoute('/docs/troubleshooting')({
  head: () => {
    const copy = getMessages('en')
    return pageSeo('en', '/docs/troubleshooting', copy.docs.metaTroubleshootingTitle, copy.docs.metaTroubleshootingDescription)
  },
  component: TroubleshootingDocs,
})
