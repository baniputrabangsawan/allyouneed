import { createFileRoute } from '@tanstack/react-router'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'
import { GettingStartedDocs } from '@/features/docs/pages'

export const Route = createFileRoute('/id/docs/getting-started')({
  head: () => {
    const copy = getMessages('id')
    return pageSeo('id', '/docs/getting-started', copy.docs.metaGettingStartedTitle, copy.docs.metaGettingStartedDescription)
  },
  component: GettingStartedDocs,
})
