import { createFileRoute } from '@tanstack/react-router'
import { PricingPage } from '@/features/licensing/PricingPage'
import { pageSeo } from '@/i18n/seo'

export const Route = createFileRoute('/pricing')({
  head: () => pageSeo(
    'en',
    '/pricing',
    'Kits Pro — Simple pricing, no account',
    'Unlock Pro tools with a 1, 6, or 12 month license. No account required.',
  ),
  component: PricingPage,
})
