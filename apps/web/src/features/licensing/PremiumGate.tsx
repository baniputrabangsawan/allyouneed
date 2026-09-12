import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { LockKeyhole } from 'lucide-react'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import { ActivateLicenseForm } from './ActivateLicenseForm'
import { hasCapability, useEntitlement } from './entitlement'

export function PremiumGate({ tool, children }: { tool: ToolDefinition; children: ReactNode }) {
  const entitlement = useEntitlement()
  if (!tool.requiresPro) return children
  if (entitlement.state === 'loading') {
    return <section className="workspace entitlement-loading" aria-busy="true" aria-label="Checking license" />
  }
  if (hasCapability(entitlement.data, tool.requiredCapability)) return children
  return (
    <section className="workspace unavailable-workspace">
      <div className="unavailable-icon"><LockKeyhole size={24} /></div>
      <p className="eyebrow">Pro tool</p>
      <h2>Activate a Pro license to use this tool.</h2>
      <p>Activate a license on this browser. One license can only be active on one installation at a time. Free tools stay available without a key.</p>
      <ActivateLicenseForm />
      <p className="option-help"><Link to="/license">Manage license</Link></p>
    </section>
  )
}
