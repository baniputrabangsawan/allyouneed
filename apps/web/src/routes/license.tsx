import { createFileRoute } from '@tanstack/react-router'
import { LicensePage } from '@/features/licensing/LicensePage'
import { pageSeo } from '@/i18n/seo'

export const Route = createFileRoute('/license')({
  head: () => pageSeo(
    'en',
    '/license',
    'Pro license | Kits',
    'Activate or deactivate a Kits Pro license on this browser. No account required.',
  ),
  component: LicensePage,
})
