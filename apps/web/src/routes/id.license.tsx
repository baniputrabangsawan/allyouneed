import { createFileRoute } from '@tanstack/react-router'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'
import { LicensePage } from '@/features/licensing/LicensePage'

export const Route = createFileRoute('/id/license')({
  head: () => {
    const copy = getMessages('id')
    return pageSeo('id', '/license', copy.license.metaTitle, copy.license.metaDescription)
  },
  component: LicensePage,
})
