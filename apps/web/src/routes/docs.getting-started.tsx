import { createFileRoute } from '@tanstack/react-router'
import { GettingStartedDocs } from '@/features/docs/pages'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'

export const Route = createFileRoute('/docs/getting-started')({
  head: () => {
    const copy = getMessages('en')
    return pageSeo('en', '/docs/getting-started', copy.docs.metaGettingStartedTitle, copy.docs.metaGettingStartedDescription)
  },
  component: GettingStartedDocs,
})
