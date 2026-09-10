import { createFileRoute } from '@tanstack/react-router'
import { ActivateLicenseForm } from '@/features/licensing/ActivateLicenseForm'

export const Route = createFileRoute('/license')({
  head: () => ({
    meta: [
      { title: 'Pro license | Kits' },
      { name: 'description', content: 'Activate or deactivate a Kits Pro license on this browser. No account required.' },
    ],
  }),
  component: LicensePage,
})

function LicensePage() {
  return (
    <main className="tool-page">
      <div className="tool-container compact-workspace">
        <p className="eyebrow">No account</p>
        <h1>Pro license</h1>
        <p>Paste a key issued for this product. Duration starts on first activation. One license is one active browser.</p>
        <ActivateLicenseForm />
      </div>
    </main>
  )
}
