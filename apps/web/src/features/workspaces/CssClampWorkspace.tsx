import { useMemo, useState, type CSSProperties } from 'react'
import { useT } from '@/i18n'
import type { ToolDefinition } from '../tools/tool-registry'
import {
  calculateClamp,
  CLAMP_PRESETS,
  DEFAULT_CLAMP_INPUT,
  formatCssNumber,
  parseClampNumber,
  valueAtViewport,
  type ClampPreset,
  type ClampUnit,
} from './css-clamp'
import { CopyButton } from './workspace-ui'

const PRESETS: ClampPreset[] = ['font-size', 'padding', 'margin', 'gap', 'custom']

function toCurrentUnit(px: number, unit: ClampUnit, rootPx: number): number {
  return unit === 'rem' ? px / rootPx : px
}

export function CssClampWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT().cssClamp
  const [preset, setPreset] = useState<ClampPreset>('font-size')
  const [property, setProperty] = useState(DEFAULT_CLAMP_INPUT.property)
  const [unit, setUnit] = useState<ClampUnit>('px')
  const [root, setRoot] = useState('16')
  const [minViewport, setMinViewport] = useState('320')
  const [maxViewport, setMaxViewport] = useState('1440')
  const [minValue, setMinValue] = useState('16')
  const [maxValue, setMaxValue] = useState('32')
  const [previewViewport, setPreviewViewport] = useState('768')

  const parsed = useMemo(() => ({
    minViewport: parseClampNumber(minViewport),
    maxViewport: parseClampNumber(maxViewport),
    minValue: parseClampNumber(minValue),
    maxValue: parseClampNumber(maxValue),
    rootPx: parseClampNumber(root),
    preview: parseClampNumber(previewViewport),
  }), [minViewport, maxViewport, minValue, maxValue, root, previewViewport])

  const result = calculateClamp({
    minViewport: parsed.minViewport ?? Number.NaN,
    maxViewport: parsed.maxViewport ?? Number.NaN,
    minValue: parsed.minValue ?? Number.NaN,
    maxValue: parsed.maxValue ?? Number.NaN,
    unit,
    rootPx: parsed.rootPx ?? Number.NaN,
    property,
  })
  const previewValue = result.ok && parsed.preview !== undefined
    ? valueAtViewport({
      minViewport: parsed.minViewport!,
      maxViewport: parsed.maxViewport!,
      minValue: parsed.minValue!,
      maxValue: parsed.maxValue!,
      unit,
      rootPx: parsed.rootPx!,
      property,
    }, parsed.preview)
    : undefined

  function applyPreset(next: ClampPreset) {
    setPreset(next)
    const def = CLAMP_PRESETS[next]
    const rootPx = parsed.rootPx && parsed.rootPx > 0 ? parsed.rootPx : 16
    if (next !== 'custom') setProperty(def.property)
    setMinValue(formatCssNumber(toCurrentUnit(def.minValue, unit, rootPx)))
    setMaxValue(formatCssNumber(toCurrentUnit(def.maxValue, unit, rootPx)))
  }

  function changeUnit(next: ClampUnit) {
    if (next === unit) return
    const rootPx = parsed.rootPx && parsed.rootPx > 0 ? parsed.rootPx : 16
    const convert = (raw: string) => {
      const value = parseClampNumber(raw)
      if (value === undefined) return raw
      return formatCssNumber(next === 'rem' ? value / rootPx : value * rootPx)
    }
    setUnit(next)
    setMinValue(convert(minValue))
    setMaxValue(convert(maxValue))
  }

  function reset() {
    setPreset('font-size')
    setProperty(DEFAULT_CLAMP_INPUT.property)
    setUnit('px')
    setRoot('16')
    setMinViewport('320')
    setMaxViewport('1440')
    setMinValue('16')
    setMaxValue('32')
    setPreviewViewport('768')
  }

  const errorMessage = !result.ok
    ? result.errors.includes('viewportOrder') ? copy.viewportOrder
      : result.errors.includes('root') ? copy.invalidRoot
        : result.errors.includes('property') ? copy.invalidProperty
          : copy.invalidNumber
    : ''

  const previewStyle = previewValue === undefined ? undefined : previewStyleFor(preset, property, previewValue, unit)

  return (
    <section className="workspace split-workspace" aria-label={tool.name}>
      <div className="options-panel">
        <div className="segmented clamp-presets" role="group" aria-label={copy.preset}>
          {PRESETS.map((item) => (
            <button key={item} type="button" className={preset === item ? 'active' : undefined} onClick={() => applyPreset(item)}>
              {copy.presets[item]}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{copy.property}</span>
          <input
            value={property}
            spellCheck={false}
            disabled={preset !== 'custom'}
            onChange={(event) => setProperty(event.target.value)}
            placeholder="font-size"
          />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>{copy.minViewport}</span>
            <input inputMode="decimal" value={minViewport} onChange={(event) => setMinViewport(event.target.value)} />
          </label>
          <label className="field">
            <span>{copy.maxViewport}</span>
            <input inputMode="decimal" value={maxViewport} onChange={(event) => setMaxViewport(event.target.value)} />
          </label>
        </div>
        <div className="field-grid">
          <label className="field">
            <span>{copy.minValue}</span>
            <input inputMode="decimal" value={minValue} onChange={(event) => setMinValue(event.target.value)} />
          </label>
          <label className="field">
            <span>{copy.maxValue}</span>
            <input inputMode="decimal" value={maxValue} onChange={(event) => setMaxValue(event.target.value)} />
          </label>
        </div>
        <div className="field-grid">
          <label className="field">
            <span>{copy.unit}</span>
            <select value={unit} onChange={(event) => changeUnit(event.target.value as ClampUnit)}>
              <option value="px">px</option>
              <option value="rem">rem</option>
            </select>
          </label>
          <label className="field">
            <span>{copy.root}</span>
            <input inputMode="decimal" value={root} onChange={(event) => setRoot(event.target.value)} />
          </label>
        </div>
        {errorMessage ? <p className="field-error" role="alert">{errorMessage}</p> : null}
        <div className="button-row">
          <button className="button secondary" type="button" onClick={reset}>{copy.reset}</button>
        </div>
      </div>
      <div className="result-card">
        <div className="panel-label"><span>{copy.generatedCss}</span></div>
        <label className="counter-editor">
          <span className="sr-only">{copy.generatedCss}</span>
          <textarea readOnly spellCheck={false} value={result.css} placeholder={copy.invalidCss} />
        </label>
        {result.ok ? <p className="option-help">{result.explanation}</p> : null}
        <div className="button-row">
          <CopyButton value={result.css} label={copy.copyCss} />
        </div>
        <label className="field">
          <span>{copy.previewViewport} {parsed.preview !== undefined ? `${formatCssNumber(parsed.preview)}px` : ''}</span>
          <input
            type="range"
            min={parsed.minViewport ?? 320}
            max={parsed.maxViewport ?? 1440}
            step="1"
            value={parsed.preview ?? 768}
            disabled={!result.ok}
            onChange={(event) => setPreviewViewport(event.target.value)}
          />
        </label>
        {previewValue !== undefined ? (
          <p className="option-help" aria-live="polite">{copy.computedValue}: {formatCssNumber(previewValue)}{unit}</p>
        ) : null}
        <div className="clamp-preview" aria-label={copy.preview}>
          {preset === 'gap' ? (
            <div className="clamp-preview-gap" style={previewStyle}>
              <span /><span /><span />
            </div>
          ) : (
            <p className="clamp-preview-sample" style={previewStyle}>{copy.previewSample}</p>
          )}
        </div>
      </div>
    </section>
  )
}

function previewStyleFor(preset: ClampPreset, property: string, value: number, unit: ClampUnit): CSSProperties | undefined {
  const sized = `${formatCssNumber(value)}${unit}`
  if (preset === 'font-size' || property === 'font-size') return { fontSize: sized }
  if (preset === 'padding' || property === 'padding') return { padding: sized }
  if (preset === 'margin' || property === 'margin') return { margin: sized }
  if (preset === 'gap' || property === 'gap') return { gap: sized }
  return undefined
}
