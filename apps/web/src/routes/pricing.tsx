import { createFileRoute } from '@tanstack/react-router'
import { PricingPage } from '@/features/licensing/PricingPage'

export const Route = createFileRoute('/pricing')({
  head: () => ({
    meta: [
      { title: 'Kits Pro — Simple pricing, no account' },
      { name: 'description', content: 'Unlock Pro tools with a 1, 6, or 12 month license. No account required.' },
    ],
  }),
  component: PricingPage,
})
