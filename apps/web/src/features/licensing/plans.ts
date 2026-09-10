import { getToolBySlug, getProTools } from '@/features/tools/tool-registry'
import type { LicensePlan } from '@/lib/api/licenses'

export interface PricingPlan {
  id: LicensePlan
  title: string
  months: 1 | 6 | 12
  price: number
  cta: string
  description: string
  secondary?: string
  badge?: string
  featured?: boolean
}

const MONTHLY_PRICE = 30_000

export const pricingPlans: readonly PricingPlan[] = [
  {
    id: 'pro_1_month',
    title: 'Pro — 1 Month',
    months: 1,
    price: 30_000,
    cta: 'Get 1 Month',
    description: 'Full Pro access for one month. Perfect for trying every premium tool.',
    secondary: 'Short-term access',
  },
  {
    id: 'pro_6_months',
    title: 'Pro — 6 Months',
    months: 6,
    price: 70_000,
    cta: 'Get 6 Months',
    description: 'Six months of full Pro access at a significantly lower monthly cost.',
    badge: 'Most popular',
    featured: true,
  },
  {
    id: 'pro_12_months',
    title: 'Pro — 12 Months',
    months: 12,
    price: 100_000,
    cta: 'Get 12 Months',
    description: 'The lowest effective monthly price for users who use Kits regularly.',
    badge: 'Best value',
  },
]

const CAPABILITY_FALLBACKS = [
  ['image.ai.background_removal', 'remove-background', 'AI Background Removal'],
  ['image.ai.upscale', 'upscale-image', 'AI Image Upscale'],
  ['media.subtitle.generate', 'add-subtitle', 'Subtitle Generator'],
  ['audio.speech_to_text', 'speech-to-text', 'Speech to Text'],
  ['document.ocr.advanced', 'ocr-pdf', 'Advanced OCR'],
  ['audio.tts.premium', 'text-to-speech', 'Premium Text to Speech'],
  ['video.processing', 'video-compressor', 'Video Processing'],
  ['pdf.large_processing', 'compress-pdf', 'Large PDF Processing'],
] as const

const EXTRA_PRO_FEATURES = ['Larger file limits', 'Batch Processing', 'Access to future Pro tools when applicable'] as const

export function formatRupiah(amount: number) {
  return `Rp${amount.toLocaleString('id-ID')}`
}

export function monthlyEquivalent(price: number, months: number) {
  return Math.round(price / months)
}

export function savingsVsMonthly(price: number, months: number) {
  return MONTHLY_PRICE * months - price
}

export function supportingPrice(plan: PricingPlan) {
  const monthly = monthlyEquivalent(plan.price, plan.months)
  return plan.months === 1 ? `${formatRupiah(monthly)} / month` : `≈ ${formatRupiah(monthly)} / month`
}

function featureLabel(capability: string, slug: string, fallback: string) {
  const fromCapability = getProTools().find((tool) => tool.requiredCapability === capability)
  if (fromCapability) return fromCapability.name
  return getToolBySlug(slug)?.name ?? fallback
}

export function proFeatureList() {
  const fromCapabilities = CAPABILITY_FALLBACKS.map(([capability, slug, fallback]) => featureLabel(capability, slug, fallback))
  const extras = getProTools()
    .map((tool) => tool.name)
    .filter((name) => !fromCapabilities.includes(name))
  return [...fromCapabilities, ...extras, ...EXTRA_PRO_FEATURES]
}

export interface ComparisonRow {
  label: string
  free: boolean
  pro: boolean
}

export function comparisonRows(): ComparisonRow[] {
  return [
    { label: 'Basic browser tools', free: true, pro: true },
    { label: 'Image / QR / Developer utilities', free: true, pro: true },
    { label: featureLabel('image.ai.background_removal', 'remove-background', 'AI Background Removal'), free: false, pro: true },
    { label: featureLabel('image.ai.upscale', 'upscale-image', 'AI Image Upscale'), free: false, pro: true },
    { label: featureLabel('media.subtitle.generate', 'add-subtitle', 'Subtitle Generator'), free: false, pro: true },
    { label: featureLabel('audio.speech_to_text', 'speech-to-text', 'Speech to Text'), free: false, pro: true },
    { label: featureLabel('document.ocr.advanced', 'ocr-pdf', 'Advanced OCR'), free: false, pro: true },
    { label: featureLabel('video.processing', 'video-compressor', 'Video Processing'), free: false, pro: true },
    { label: 'Large file processing', free: false, pro: true },
    { label: 'Batch processing', free: false, pro: true },
  ]
}
