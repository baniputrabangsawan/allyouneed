import { ActivateLicenseForm } from '@/features/licensing/ActivateLicenseForm'

export function LicensePage() {
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
