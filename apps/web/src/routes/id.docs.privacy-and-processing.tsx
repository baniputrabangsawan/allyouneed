import { createFileRoute } from '@tanstack/react-router'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'
import { PrivacyDocs } from '@/features/docs/pages'

export const Route = createFileRoute('/id/docs/privacy-and-processing')({
  head: () => {
    const copy = getMessages('id')
    return pageSeo('id', '/docs/privacy-and-processing', copy.docs.metaPrivacyTitle, copy.docs.metaPrivacyDescription)
  },
  component: PrivacyDocs,
})
