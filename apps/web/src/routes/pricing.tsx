import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, Minus } from 'lucide-react'
import { useState } from 'react'
import {
  comparisonRows,
  formatRupiah,
  pricingPlans,
  proFeatureList,
  savingsVsMonthly,
  supportingPrice,
  type PricingPlan,
} from '@/features/licensing/plans'
import type { LicensePlan } from '@/lib/api/licenses'

export const Route = createFileRoute('/pricing')({
  head: () => ({
    meta: [
      { title: 'Pricing | Kits' },
      { name: 'description', content: 'Unlock all Kits Pro tools with one license. No account required. Choose 1, 6, or 12 months.' },
    ],
  }),
  component: PricingPage,
})

const faqs = [
  { question: 'Do I need an account?', answer: 'No.' },
  { question: 'Can I use one license on multiple devices?', answer: 'One active installation at a time.' },
  { question: 'Can I move my license to another device?', answer: 'Yes, deactivate the current installation first.' },
  { question: 'Does my license expire?', answer: 'Yes, based on the selected 1, 6, or 12-month period.' },
  { question: 'Can I renew the same license?', answer: 'Yes. Renewal extends the existing license.' },
  { question: 'Are Free tools still available after Pro expires?', answer: 'Yes. The app returns to Free access.' },
] as const

function PricingPage() {
  const [selected, setSelected] = useState<LicensePlan>('pro_6_months')
  const [copied, setCopied] = useState(false)
  const selectedPlan = pricingPlans.find((plan) => plan.id === selected) ?? pricingPlans[1]
  const features = proFeatureList()
  const rows = comparisonRows()

  function choose(plan: PricingPlan) {
    setSelected(plan.id)
    setCopied(false)
    document.getElementById('get-pro')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function copyPlan() {
    if (!selectedPlan) return
    const text = `${selectedPlan.title}\n${formatRupiah(selectedPlan.price)}\nPlan: ${selectedPlan.id}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="pricing-page">
      <header className="pricing-hero">
        <p className="eyebrow">Pricing</p>
        <h1>Simple pricing.<br />No account required.</h1>
        <p>Unlock all Pro tools with one license. Activate once and start using Kits immediately.</p>
        <p className="pricing-support">No account to create. No password to remember. Choose how long you want Pro access.</p>
      </header>

      <section className="pricing-plans" aria-label="Pro plans">
        {pricingPlans.map((plan) => {
          const savings = savingsVsMonthly(plan.price, plan.months)
          return (
            <article key={plan.id} className={`pricing-card${plan.featured ? ' featured' : ''}`}>
              {plan.badge && <p className="pricing-badge">{plan.badge}</p>}
              <h2>{plan.title}</h2>
              <p className="pricing-price">{formatRupiah(plan.price)}</p>
              <p className="pricing-monthly">{supportingPrice(plan)}</p>
              {savings > 0 && <p className="pricing-savings">Save {formatRupiah(savings)} compared with monthly access</p>}
              {plan.secondary && <p className="pricing-secondary">{plan.secondary}</p>}
              <p>{plan.description}</p>
              <button className={plan.featured ? 'button primary' : 'button'} type="button" onClick={() => choose(plan)}>
                {plan.cta}
              </button>
            </article>
          )
        })}
      </section>

      <section id="get-pro" className="pricing-get">
        <p className="eyebrow">Manual purchase</p>
        <h2>Get a Pro license</h2>
        {selectedPlan && (
          <>
            <p>
              Selected plan: <strong>{selectedPlan.title}</strong> · {formatRupiah(selectedPlan.price)}
            </p>
            <p>
              Kits does not process payments in the app. After your purchase is confirmed, you receive a license key for this plan. Then activate it on this browser — no account required.
            </p>
            <div className="pricing-get-actions">
              <button className="button primary" type="button" onClick={() => void copyPlan()}>
                {copied ? 'Plan details copied' : 'Copy plan details'}
              </button>
              <Link className="button" to="/license">I already have a license</Link>
            </div>
            <p className="pricing-plan-id">Plan identifier: {selectedPlan.id}</p>
          </>
        )}
      </section>

      <section className="pricing-features">
        <p className="eyebrow">Same access</p>
        <h2>All Pro plans include</h2>
        <p>Every duration unlocks the same Pro capabilities. Only the license period changes.</p>
        <ul>
          {features.map((feature) => (
            <li key={feature}><Check size={16} aria-hidden="true" />{feature}</li>
          ))}
        </ul>
      </section>

      <section className="pricing-license">
        <p className="eyebrow">How licenses work</p>
        <h2>1 license = 1 active installation</h2>
        <p>Your license can be active on one device/browser installation at a time. Deactivate it before moving your license to another device.</p>
        <ul>
          <li>No account required</li>
          <li>No login required</li>
          <li>License can be renewed</li>
          <li>1, 6, and 12-month licenses expire automatically</li>
          <li>Existing licenses can be renewed without receiving a new key</li>
        </ul>
      </section>

      <section className="pricing-compare" aria-labelledby="compare-heading">
        <p className="eyebrow">Compare</p>
        <h2 id="compare-heading">Free vs Pro</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Free</th>
              <th scope="col">Pro</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.free ? <span><Check size={16} aria-hidden="true" /> Included</span> : <span className="muted"><Minus size={16} aria-hidden="true" /> Not included</span>}</td>
                <td>{row.pro ? <span><Check size={16} aria-hidden="true" /> Included</span> : <span className="muted"><Minus size={16} aria-hidden="true" /> Not included</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="pricing-fair">
        <h2>Fair use</h2>
        <p>Pro includes generous processing limits designed for normal personal and professional use.</p>
      </section>

      <section className="pricing-faq">
        <p className="eyebrow">Questions</p>
        <h2>FAQ</h2>
        <dl>
          {faqs.map((item) => (
            <div key={item.question}>
              <dt>{item.question}</dt>
              <dd>{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  )
}
