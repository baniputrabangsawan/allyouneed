import { createFileRoute } from '@tanstack/react-router'
import { PrivacyDocs } from '@/features/docs/pages'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'

export const Route = createFileRoute('/docs/privacy-and-processing')({
  head: () => {
    const copy = getMessages('en')
    return pageSeo('en', '/docs/privacy-and-processing', copy.docs.metaPrivacyTitle, copy.docs.metaPrivacyDescription)
  },
  component: PrivacyDocs,
})
