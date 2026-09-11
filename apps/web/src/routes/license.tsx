import { createFileRoute } from '@tanstack/react-router'
import { LicensePage } from '@/features/licensing/LicensePage'

export const Route = createFileRoute('/license')({
  head: () => ({
    meta: [
      { title: 'Pro license | Kits' },
      { name: 'description', content: 'Activate or deactivate a Kits Pro license on this browser. No account required.' },
    ],
  }),
  component: LicensePage,
})
