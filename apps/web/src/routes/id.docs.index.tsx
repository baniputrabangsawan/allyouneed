import { createFileRoute } from '@tanstack/react-router'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'
import { DocsIndex } from '@/features/docs/pages'

export const Route = createFileRoute('/id/docs/')({
  head: () => {
    const copy = getMessages('id')
    return pageSeo('id', '/docs', copy.docs.metaLandingTitle, copy.docs.metaLandingDescription)
  },
  component: DocsIndex,
})
