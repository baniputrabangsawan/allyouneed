export type ClampUnit = 'px' | 'rem'
export type ClampPreset = 'font-size' | 'padding' | 'margin' | 'gap' | 'custom'
export type ClampError =
  | 'minViewport'
  | 'maxViewport'
  | 'viewportOrder'
  | 'minValue'
  | 'maxValue'
  | 'root'
  | 'property'

export interface ClampInput {
  minViewport: number
  maxViewport: number
  minValue: number
  maxValue: number
  unit: ClampUnit
  rootPx: number
  property: string
}

export interface ClampResult {
  ok: boolean
  css: string
  preferred: string
  explanation: string
  errors: ClampError[]
  minCss: string
  maxCss: string
  slope: number
  intercept: number
}

export const CLAMP_PRESETS: Record<ClampPreset, { property: string; minValue: number; maxValue: number }> = {
  'font-size': { property: 'font-size', minValue: 16, maxValue: 32 },
  padding: { property: 'padding', minValue: 16, maxValue: 48 },
  margin: { property: 'margin', minValue: 8, maxValue: 32 },
  gap: { property: 'gap', minValue: 8, maxValue: 24 },
  custom: { property: '', minValue: 16, maxValue: 32 },
}

export const DEFAULT_CLAMP_INPUT: ClampInput = {
  minViewport: 320,
  maxViewport: 1440,
  minValue: 16,
  maxValue: 32,
  unit: 'px',
  rootPx: 16,
  property: 'font-size',
}

const PROPERTY_RE = /^-?[a-z][a-z0-9-]*$/

export function isCssProperty(value: string): boolean {
  return PROPERTY_RE.test(value.trim())
}

export function formatCssNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 1e4) / 1e4
  const n = Object.is(rounded, -0) ? 0 : rounded
  return String(n)
}

export function parseClampNumber(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : undefined
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value)
}

function toPx(value: number, unit: ClampUnit, rootPx: number): number {
  return unit === 'rem' ? value * rootPx : value
}

function fromPx(value: number, unit: ClampUnit, rootPx: number): number {
  return unit === 'rem' ? value / rootPx : value
}

function withUnit(value: number, unit: ClampUnit): string {
  return `${formatCssNumber(value)}${unit}`
}

function formatPreferred(vw: number, intercept: number, unit: ClampUnit): string {
  const vwPart = `${formatCssNumber(vw)}vw`
  if (intercept === 0) return vwPart
  const absIntercept = withUnit(Math.abs(intercept), unit)
  if (vw === 0) return intercept < 0 ? `-${absIntercept.replace('-', '')}` : withUnit(intercept, unit)
  return intercept < 0 ? `${vwPart} - ${absIntercept}` : `${vwPart} + ${absIntercept}`
}

export function calculateClamp(input: ClampInput): ClampResult {
  const errors: ClampError[] = []
  const property = input.property.trim()
  if (!finitePositive(input.minViewport)) errors.push('minViewport')
  if (!finitePositive(input.maxViewport)) errors.push('maxViewport')
  if (!finitePositive(input.minValue)) errors.push('minValue')
  if (!finitePositive(input.maxValue)) errors.push('maxValue')
  if (!Number.isFinite(input.rootPx) || input.rootPx <= 0) errors.push('root')
  if (!isCssProperty(property)) errors.push('property')
  if (
    Number.isFinite(input.minViewport)
    && Number.isFinite(input.maxViewport)
    && input.minViewport >= input.maxViewport
  ) {
    errors.push('viewportOrder')
  }

  if (errors.length) {
    return { ok: false, css: '', preferred: '', explanation: '', errors, minCss: '', maxCss: '', slope: 0, intercept: 0 }
  }

  const minPx = toPx(input.minValue, input.unit, input.rootPx)
  const maxPx = toPx(input.maxValue, input.unit, input.rootPx)
  const slope = (maxPx - minPx) / (input.maxViewport - input.minViewport)
  const interceptPx = minPx - slope * input.minViewport
  const vw = slope * 100
  const intercept = fromPx(interceptPx, input.unit, input.rootPx)
  const cssMin = fromPx(Math.min(minPx, maxPx), input.unit, input.rootPx)
  const cssMax = fromPx(Math.max(minPx, maxPx), input.unit, input.rootPx)
  const minCss = withUnit(cssMin, input.unit)
  const maxCss = withUnit(cssMax, input.unit)
  const preferred = formatPreferred(vw, intercept, input.unit)
  const css = `${property}: clamp(${minCss}, ${preferred}, ${maxCss});`
  const explanation = `From ${formatCssNumber(input.minViewport)}px to ${formatCssNumber(input.maxViewport)}px, ${property} goes from ${withUnit(input.minValue, input.unit)} to ${withUnit(input.maxValue, input.unit)}. Preferred value = ${preferred}.`

  return { ok: true, css, preferred, explanation, errors, minCss, maxCss, slope, intercept }
}

export function valueAtViewport(input: ClampInput, viewportPx: number): number | undefined {
  const result = calculateClamp(input)
  if (!result.ok || !Number.isFinite(viewportPx)) return undefined
  const minPx = toPx(input.minValue, input.unit, input.rootPx)
  const maxPx = toPx(input.maxValue, input.unit, input.rootPx)
  const raw = result.slope * viewportPx + toPx(result.intercept, input.unit, input.rootPx)
  const lo = Math.min(minPx, maxPx)
  const hi = Math.max(minPx, maxPx)
  return fromPx(Math.min(hi, Math.max(lo, raw)), input.unit, input.rootPx)
}
