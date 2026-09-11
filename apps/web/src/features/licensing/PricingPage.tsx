import { Check, ChevronDown, Minus } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  comparisonRows,
  formatRupiah,
  monthlyEquivalent,
  pricingPlans,
  proFeatureList,
  savingsVsMonthly,
  type PricingPlan,
} from '@/features/licensing/plans'
import { getProTools, getToolBySlug } from '@/features/tools/tool-registry'
import type { LicensePlan } from '@/lib/api/licenses'
import { LocaleLink } from '@/i18n/link'
import { useLocale, useT, type Messages } from '@/i18n'
import { localizeTool } from '@/i18n/tools'
import { useGSAP } from '@/lib/motion/gsap'
import { prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { revealSectionOnce } from '@/lib/motion/scroll'

function cardClass(plan: PricingPlan) {
  return ['pricing-card', plan.featured && 'featured', plan.value && 'value'].filter(Boolean).join(' ')
}

function localizedPlan(plan: PricingPlan, copy: Messages) {
  if (plan.id === 'pro_1_month') {
    return { title: copy.pricing.month1Title, cta: copy.pricing.month1Cta, description: copy.pricing.month1Description, badge: copy.pricing.month1Badge }
  }
  if (plan.id === 'pro_6_months') {
    return { title: copy.pricing.month6Title, cta: copy.pricing.month6Cta, description: copy.pricing.month6Description, badge: copy.pricing.month6Badge }
  }
  return { title: copy.pricing.month12Title, cta: copy.pricing.month12Cta, description: copy.pricing.month12Description, badge: copy.pricing.month12Badge }
}

export function PricingPage() {
  const copy = useT()
  const locale = useLocale()
  const [selected, setSelected] = useState<LicensePlan>('pro_6_months')
  const [copied, setCopied] = useState(false)
  const pageRef = useRef<HTMLElement>(null)
  const selectedPlan = pricingPlans.find((plan) => plan.id === selected) ?? pricingPlans[1]
  const selectedCopy = selectedPlan ? localizedPlan(selectedPlan, copy) : undefined
  const extraEnglish = ['Larger file limits', 'Batch Processing', 'Access to future Pro tools when applicable']
  const features = proFeatureList().map((name) => {
    const extraIndex = extraEnglish.indexOf(name)
    if (extraIndex >= 0) return copy.pricing.extra[extraIndex] ?? name
    const tool = getProTools().find((item) => item.name === name)
    return tool ? localizeTool(tool, locale).name : name
  })
  const rows = comparisonRows().map((row) => {
    const mapped: Record<string, string> = {
      'Basic browser tools': copy.pricing.compareBasic,
      'Image / QR / Developer utilities': copy.pricing.compareUtilities,
      'Large file processing': copy.pricing.compareLarge,
      'Batch processing': copy.pricing.compareBatch,
    }
    const tool = getToolBySlug(
      ['remove-background', 'upscale-image', 'add-subtitle', 'speech-to-text', 'ocr-pdf', 'video-compressor']
        .find((slug) => getToolBySlug(slug)?.name === row.label) ?? '',
    )
    return {
      ...row,
      label: mapped[row.label] ?? (tool ? localizeTool(tool, locale).name : row.label),
    }
  })
  const faqs = [
    { question: copy.pricing.faqAccountQ, answer: copy.pricing.faqAccountA },
    { question: copy.pricing.faqDevicesQ, answer: copy.pricing.faqDevicesA },
    { question: copy.pricing.faqMoveQ, answer: copy.pricing.faqMoveA },
    { question: copy.pricing.faqExpireQ, answer: copy.pricing.faqExpireA },
    { question: copy.pricing.faqRenewQ, answer: copy.pricing.faqRenewA },
    { question: copy.pricing.faqFreeAfterQ, answer: copy.pricing.faqFreeAfterA },
  ]

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
    if (!selectedPlan || !selectedCopy) return
    const text = `${selectedCopy.title}\n${formatRupiah(selectedPlan.price)}\nPlan: ${selectedPlan.id}`
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
        <p className="eyebrow">{copy.pricing.eyebrow}</p>
        <h1>{copy.pricing.titleA}<br />{copy.pricing.titleB}</h1>
        <p>{copy.pricing.copy}</p>
        <p className="pricing-support">{copy.pricing.support}</p>
      </header>

      <section className="pricing-plans" aria-label={copy.pricing.plansAria}>
        {pricingPlans.map((plan) => {
          const savings = savingsVsMonthly(plan.price, plan.months)
          const labels = localizedPlan(plan, copy)
          const monthly = formatRupiah(monthlyEquivalent(plan.price, plan.months))
          return (
            <article key={plan.id} className={cardClass(plan)}>
              <div className="pricing-card-head">
                {labels.badge && <p className="pricing-badge">{labels.badge}</p>}
                <h2>{labels.title}</h2>
              </div>
              <div className="pricing-card-price">
                <p className="pricing-price">{formatRupiah(plan.price)}</p>
                <p className="pricing-monthly">{plan.months === 1 ? copy.pricing.perMonth(monthly) : copy.pricing.approxPerMonth(monthly)}</p>
                <p className="pricing-savings" aria-hidden={savings <= 0}>{savings > 0 ? copy.pricing.saveVsMonthly(formatRupiah(savings)) : '\u00a0'}</p>
              </div>
              <p className="pricing-card-copy">{labels.description}</p>
              <ul className="pricing-card-features">
                {copy.pricing.highlights.map((item) => (
                  <li key={item}><Check size={15} aria-hidden="true" />{item}</li>
                ))}
              </ul>
              <div className="pricing-card-cta">
                <button className={plan.featured || plan.value ? 'button primary' : 'button'} type="button" onClick={() => choose(plan)}>
                  {labels.cta}
                </button>
                <p className="pricing-card-note">{copy.pricing.manualNote}</p>
              </div>
            </article>
          )
        })}
      </section>

      <section id="get-pro" className="pricing-get">
        <p className="eyebrow">{copy.pricing.getEyebrow}</p>
        <h2>{copy.pricing.getTitle}</h2>
        {selectedPlan && selectedCopy && (
          <>
            <p>{copy.pricing.selectedPlan(selectedCopy.title, formatRupiah(selectedPlan.price))}</p>
            <p>{copy.pricing.getBody}</p>
            <div className="pricing-get-actions">
              <button className="button primary" type="button" onClick={() => void copyPlan()}>
                {copied ? copy.pricing.copied : copy.pricing.copyDetails}
              </button>
              <LocaleLink className="button" to="/license">{copy.pricing.haveLicense}</LocaleLink>
            </div>
            <p className="pricing-plan-id">{copy.pricing.planId}: {selectedPlan.id}</p>
          </>
        )}
      </section>

      <section className="pricing-features">
        <p className="eyebrow">{copy.pricing.sameAccess}</p>
        <h2>{copy.pricing.allInclude}</h2>
        <p>{copy.pricing.allIncludeCopy}</p>
        <ul>
          {features.map((feature) => (
            <li key={feature}><Check size={16} aria-hidden="true" />{feature}</li>
          ))}
        </ul>
      </section>

      <section className="pricing-license">
        <p className="eyebrow">{copy.pricing.howLicenses}</p>
        <h2>{copy.pricing.oneInstall}</h2>
        <p>{copy.pricing.oneInstallCopy}</p>
        <ul>
          <li><Check size={16} aria-hidden="true" />{copy.pricing.noAccount}</li>
          <li><Check size={16} aria-hidden="true" />{copy.pricing.noLogin}</li>
          <li><Check size={16} aria-hidden="true" />{copy.pricing.canRenew}</li>
          <li><Check size={16} aria-hidden="true" />{copy.pricing.expireAuto}</li>
          <li><Check size={16} aria-hidden="true" />{copy.pricing.renewSameKey}</li>
        </ul>
      </section>

      <section className="pricing-compare" aria-labelledby="compare-heading">
        <p className="eyebrow">{copy.pricing.compare}</p>
        <h2 id="compare-heading">{copy.pricing.freeVsPro}</h2>
        <div className="pricing-compare-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{copy.pricing.capability}</th>
                <th scope="col">{copy.pricing.freeCol}</th>
                <th scope="col">{copy.pricing.proCol}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.free ? <span><Check size={16} aria-hidden="true" /> {copy.pricing.included}</span> : <span className="muted"><Minus size={16} aria-hidden="true" /> {copy.pricing.notIncluded}</span>}</td>
                  <td>{row.pro ? <span><Check size={16} aria-hidden="true" /> {copy.pricing.included}</span> : <span className="muted"><Minus size={16} aria-hidden="true" /> {copy.pricing.notIncluded}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pricing-fair">
        <h2>{copy.pricing.fairUse}</h2>
        <p>{copy.pricing.fairUseCopy}</p>
      </section>

      <section className="pricing-faq">
        <p className="eyebrow">{copy.pricing.questions}</p>
        <h2>{copy.pricing.faq}</h2>
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
