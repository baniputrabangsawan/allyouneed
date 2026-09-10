import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, ChevronDown, Minus } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  comparisonRows,
  formatRupiah,
  planCardHighlights,
  pricingPlans,
  proFeatureList,
  savingsVsMonthly,
  supportingPrice,
  type PricingPlan,
} from '@/features/licensing/plans'
import type { LicensePlan } from '@/lib/api/licenses'
import { useGSAP } from '@/lib/motion/gsap'
import { prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { revealSectionOnce } from '@/lib/motion/scroll'

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

function cardClass(plan: PricingPlan) {
  return ['pricing-card', plan.featured && 'featured', plan.value && 'value'].filter(Boolean).join(' ')
}

function PricingPage() {
  const [selected, setSelected] = useState<LicensePlan>('pro_6_months')
  const [copied, setCopied] = useState(false)
  const pageRef = useRef<HTMLElement>(null)
  const selectedPlan = pricingPlans.find((plan) => plan.id === selected) ?? pricingPlans[1]
  const features = proFeatureList()
  const rows = comparisonRows()

  useGSAP(() => {
    if (prefersReducedMotion()) return
    const root = pageRef.current
    if (!root) return
    revealSectionOnce(root.querySelector('.pricing-features'))
    revealSectionOnce(root.querySelector('.pricing-compare'))
    revealSectionOnce(root.querySelector('.pricing-faq'))
  }, { scope: pageRef })


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
    <main ref={pageRef} className="pricing-page">
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
            <article key={plan.id} className={cardClass(plan)}>
              <div className="pricing-card-head">
                {plan.badge && <p className="pricing-badge">{plan.badge}</p>}
                <h2>{plan.title}</h2>
              </div>
              <div className="pricing-card-price">
                <p className="pricing-price">{formatRupiah(plan.price)}</p>
                <p className="pricing-monthly">{supportingPrice(plan)}</p>
                <p className="pricing-savings" aria-hidden={savings <= 0}>{savings > 0 ? `Save ${formatRupiah(savings)} compared with monthly access` : '\u00a0'}</p>
              </div>
              <p className="pricing-card-copy">{plan.description}</p>
              <ul className="pricing-card-features">
                {planCardHighlights.map((item) => (
                  <li key={item}><Check size={15} aria-hidden="true" />{item}</li>
                ))}
              </ul>
              <div className="pricing-card-cta">
                <button className={plan.featured || plan.value ? 'button primary' : 'button'} type="button" onClick={() => choose(plan)}>
                  {plan.cta}
                </button>
                <p className="pricing-card-note">Manual purchase. No account required.</p>
              </div>
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
          <li><Check size={16} aria-hidden="true" />No account required</li>
          <li><Check size={16} aria-hidden="true" />No login required</li>
          <li><Check size={16} aria-hidden="true" />License can be renewed</li>
          <li><Check size={16} aria-hidden="true" />1, 6, and 12-month licenses expire automatically</li>
          <li><Check size={16} aria-hidden="true" />Existing licenses can be renewed without receiving a new key</li>
        </ul>
      </section>

      <section className="pricing-compare" aria-labelledby="compare-heading">
        <p className="eyebrow">Compare</p>
        <h2 id="compare-heading">Free vs Pro</h2>
        <div className="pricing-compare-wrap">
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
        </div>
      </section>

      <section className="pricing-fair">
        <h2>Fair use</h2>
        <p>Pro includes generous processing limits designed for normal personal and professional use.</p>
      </section>

      <section className="pricing-faq">
        <p className="eyebrow">Questions</p>
        <h2>FAQ</h2>
        <div className="pricing-faq-list">
          {faqs.map((item) => (
            <details key={item.question}>
              <summary>
                {item.question}
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  )
}
