import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { ToolDefinition } from '../tools/tool-registry'
import { contrastForeground, hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from './workspace-utils'
import { CopyButton, DownloadButton } from './workspace-ui'

const LIGHTNESS_OFFSETS = [-30, -15, 0, 15, 30] as const

function colorDetails(hex: string) {
  const rgb = hexToRgb(hex)
  const hsl = rgbToHsl(rgb)
  const value = rgbToHex(rgb)
  return {
    hex: value,
    rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    hsl: `${hsl.h}, ${hsl.s}%, ${hsl.l}%`,
    output: `HEX: ${value}\nRGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\nHSL: hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`,
  }
}

function generateSwatches(hex: string): string[] {
  const hsl = rgbToHsl(hexToRgb(hex))
  return LIGHTNESS_OFFSETS.map((offset) => rgbToHex(hslToRgb({ ...hsl, l: Math.max(5, Math.min(95, hsl.l + offset)) })))
}

function ColorValueRows({ hex }: { hex: string }) {
  let details: ReturnType<typeof colorDetails> | undefined
  try { details = colorDetails(hex) } catch { details = undefined }
  if (!details) return null
  return (
    <dl className="color-value-list">
      {([['HEX', details.hex], ['RGB', details.rgb], ['HSL', details.hsl]] as const).map(([label, value]) => (
        <div className="color-value-row" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
          <CopyButton value={value} className="color-copy-mini" />
        </div>
      ))}
    </dl>
  )
}

export function ColorWorkspace({ tool }: { tool: ToolDefinition }) {
  const [hex, setHex] = useState('#3B82F6')
  const [error, setError] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(2)
  const [copiedSwatch, setCopiedSwatch] = useState('')
  const copyTimer = useRef<number | undefined>(undefined)
  const palette = tool.slug.includes('palette')
  let swatches: string[] = []
  let details: ReturnType<typeof colorDetails> | undefined
  try {
    details = colorDetails(hex)
    swatches = palette ? generateSwatches(hex) : [details.hex]
  } catch {
    details = undefined
    swatches = []
  }
  const selected = swatches[Math.min(selectedIndex, Math.max(swatches.length - 1, 0))] ?? details?.hex ?? ''
  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  function validate() {
    try {
      hexToRgb(hex)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Invalid color.')
    }
  }

  async function copySwatch(color: string) {
    try {
      await navigator.clipboard.writeText(color)
      setCopiedSwatch(color)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopiedSwatch(''), 1500)
    } catch {
      setCopiedSwatch('')
    }
  }

  function selectSwatch(index: number, color: string) {
    setSelectedIndex(index)
    void copySwatch(color)
  }

  const pickerValue = /^#[\da-f]{6}$/i.test(hex) ? hex : '#3B82F6'
  const paletteText = swatches.join('\n')
  const downloadValue = palette ? paletteText : details?.output ?? ''

  return (
    <section className="workspace color-workspace">
      <div className="color-workspace-top">
        <div className="options-panel">
          <p className="color-panel-title">Base color</p>
          <label className="field">
            <span>Color</span>
            <input aria-label="Color" type="color" value={pickerValue} onChange={(event) => { setHex(event.target.value); setError('') }} />
          </label>
          <label className="field">
            <span>HEX value</span>
            <input aria-label="HEX value" value={hex} onChange={(event) => setHex(event.target.value)} onBlur={validate} />
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
        </div>
        <div className="result-card color-selected-card">
          <p className="color-panel-title">Selected color</p>
          <div
            className="color-selected-preview"
            aria-label="Selected color preview"
            style={selected ? { background: selected } : undefined}
          />
          <ColorValueRows hex={selected} />
          {!palette && (
            <div className="button-row">
              <CopyButton value={details?.output ?? ''} />
              <DownloadButton value={downloadValue} filename="colors.txt" />
            </div>
          )}
        </div>
      </div>
      {palette && (
        <div className="result-card color-palette-card">
          <p className="color-panel-title">Generated palette</p>
          <div className="color-swatch-grid" aria-label="Generated color palette">
            {swatches.map((color, index) => {
              const isSelected = index === selectedIndex
              const copied = copiedSwatch === color
              return (
                <div className={isSelected ? 'color-swatch is-selected' : 'color-swatch'} key={`${color}-${index}`}>
                  <button
                    type="button"
                    className="color-swatch-preview"
                    aria-label={color}
                    aria-pressed={isSelected}
                    style={{ background: color, color: contrastForeground(color) }}
                    onClick={() => selectSwatch(index, color)}
                  >
                    {isSelected && <Check size={18} strokeWidth={2.4} aria-hidden="true" />}
                  </button>
                  <div className="color-swatch-footer">
                    <span className="color-swatch-hex">{color}</span>
                    <button
                      type="button"
                      className={copied ? 'color-swatch-copy is-copied' : 'color-swatch-copy'}
                      aria-label={copied ? `Copied ${color}` : `Copy ${color}`}
                      onClick={() => {
                        setSelectedIndex(index)
                        void copySwatch(color)
                      }}
                    >
                      {copied ? <Check size={14} strokeWidth={2.4} aria-hidden="true" /> : <Copy size={14} strokeWidth={2.2} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="button-row">
            <CopyButton value={paletteText} label="Copy Palette" keepWidth />
            <DownloadButton value={downloadValue} filename="colors.txt" label="Download Palette" />
          </div>
        </div>
      )}
    </section>
  )
}
