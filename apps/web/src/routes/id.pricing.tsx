import { createFileRoute } from '@tanstack/react-router'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'
import { PricingPage } from '@/features/licensing/PricingPage'

export const Route = createFileRoute('/id/pricing')({
  head: () => {
    const copy = getMessages('id')
    return pageSeo('id', '/pricing', copy.pricing.metaTitle, copy.pricing.metaDescription)
  },
  component: PricingPage,
})
