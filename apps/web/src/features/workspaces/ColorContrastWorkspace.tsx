import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { ToolDefinition } from '../tools/tool-registry'
import {
  evaluateContrast,
  formatContrastRatio,
  parseColor,
  rgbToHex,
  WCAG_AA_LARGE,
  WCAG_AA_NORMAL,
  WCAG_AAA_LARGE,
  WCAG_AAA_NORMAL,
} from './workspace-utils'

const DEFAULT_FOREGROUND = '#111111'
const DEFAULT_BACKGROUND = '#FFFFFF'

export function ColorContrastWorkspace({ tool }: { tool: ToolDefinition }) {
  const [foreground, setForeground] = useState(DEFAULT_FOREGROUND)
  const [background, setBackground] = useState(DEFAULT_BACKGROUND)

  const foregroundError = colorError(foreground)
  const backgroundError = colorError(background)
  const check = !foregroundError && !backgroundError ? evaluateContrast(foreground, background) : undefined

  function swap() {
    setForeground(background)
    setBackground(foreground)
  }

  return (
    <section className="workspace color-workspace contrast-workspace" aria-label={tool.name}>
      <div className="color-workspace-top">
        <div className="options-panel">
          <p className="color-panel-title">Colors</p>
          <ColorField
            label="Foreground color"
            value={foreground}
            fallback={DEFAULT_FOREGROUND}
            error={foregroundError}
            onChange={setForeground}
          />
          <ColorField
            label="Background color"
            value={background}
            fallback={DEFAULT_BACKGROUND}
            error={backgroundError}
            onChange={setBackground}
          />
          <div className="button-row">
            <button className="button secondary" type="button" onClick={swap}>Swap colors</button>
          </div>
          <p className="option-help" role="note">
            WCAG 2 contrast for one text color on one background. AA needs {WCAG_AA_NORMAL}:1 for normal text and {WCAG_AA_LARGE}:1 for large text.
            AAA needs {WCAG_AAA_NORMAL}:1 and {WCAG_AAA_LARGE}:1. Large text is 18pt (24px) regular or 14pt bold.
            Passing this pair does not mean a whole page or product is accessible.
          </p>
        </div>

        <div className="result-card contrast-result-card">
          <p className="color-panel-title">Contrast ratio</p>
          {check ? (
            <>
              <p className="contrast-ratio" aria-live="polite">{formatContrastRatio(check.ratio)}</p>
              <section className="contrast-level" aria-labelledby="contrast-aa-heading">
                <h3 id="contrast-aa-heading">WCAG AA</h3>
                <VerdictRow label="Normal text" pass={check.aaNormal} />
                <VerdictRow label="Large text" pass={check.aaLarge} />
              </section>
              <section className="contrast-level" aria-labelledby="contrast-aaa-heading">
                <h3 id="contrast-aaa-heading">WCAG AAA</h3>
                <VerdictRow label="Normal text" pass={check.aaaNormal} />
                <VerdictRow label="Large text" pass={check.aaaLarge} />
              </section>
            </>
          ) : (
            <p className="option-help">Fix HEX or RGB on both sides to calculate contrast.</p>
          )}
        </div>
      </div>

      {check ? (
        <div className="result-card contrast-preview-card">
          <p className="color-panel-title">Preview</p>
          <div
            className="contrast-preview"
            style={{ color: check.foregroundHex, background: check.backgroundHex }}
          >
            <p className="contrast-preview-normal">Normal text at 16px. Body copy uses the AA 4.5:1 threshold.</p>
            <p className="contrast-preview-large">Large text at 24px. Large text may pass at 3:1.</p>
            <div className="contrast-preview-row">
              <button
                className="contrast-preview-button"
                type="button"
                style={{ color: check.foregroundHex, background: check.backgroundHex, borderColor: check.foregroundHex }}
              >
                Button
              </button>
              <a className="contrast-preview-link" href="#preview" style={{ color: check.foregroundHex }} onClick={(event) => event.preventDefault()}>
                Link
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ColorField({
  label,
  value,
  fallback,
  error,
  onChange,
}: {
  label: string
  value: string
  fallback: string
  error?: string | undefined
  onChange: (value: string) => void
}) {
  const picker = pickerHex(value, fallback)
  const errorId = `${label.replace(/\s+/gu, '-').toLowerCase()}-error`
  return (
    <div className="contrast-color-field">
      <label className="field">
        <span>{label}</span>
        <span className="contrast-color-inputs">
          <input
            type="color"
            aria-label={`${label} picker`}
            value={picker}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
          />
          <input
            aria-label={label}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            spellCheck={false}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="#111111 or rgb(17, 17, 17)"
          />
        </span>
      </label>
      {error ? <p id={errorId} className="field-error" role="alert">{error}</p> : null}
    </div>
  )
}

function VerdictRow({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className={`contrast-verdict-row ${pass ? 'is-pass' : 'is-fail'}`}>
      <span>{label}</span>
      <span className="contrast-verdict">
        {pass
          ? <Check size={18} strokeWidth={2.4} aria-hidden="true" />
          : <X size={18} strokeWidth={2.4} aria-hidden="true" />}
        {pass ? 'Pass' : 'Fail'}
      </span>
    </div>
  )
}

function colorError(value: string) {
  try {
    parseColor(value)
    return undefined
  } catch (reason) {
    return reason instanceof Error ? reason.message : 'Invalid color.'
  }
}

function pickerHex(value: string, fallback: string) {
  try {
    return rgbToHex(parseColor(value))
  } catch {
    return fallback
  }
}
