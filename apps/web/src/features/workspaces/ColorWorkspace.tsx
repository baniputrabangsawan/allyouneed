import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from './workspace-utils'
import { CopyButton, DownloadButton } from './workspace-ui'

export function ColorWorkspace({ tool }: { tool: ToolDefinition }) {
  const [hex, setHex] = useState('#3B82F6')
  const [error, setError] = useState('')
  let output = ''
  let swatches: string[] = []
  try {
    const rgb = hexToRgb(hex), hsl = rgbToHsl(rgb)
    output = `HEX: ${rgbToHex(rgb)}\nRGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\nHSL: hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`
    swatches = [-30, -15, 0, 15, 30].map((offset) => rgbToHex(hslToRgb({ ...hsl, l: Math.max(5, Math.min(95, hsl.l + offset)) })))
  } catch { output = ''; swatches = [] }
  function validate() { try { hexToRgb(hex); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invalid color.') } }
  const palette = tool.slug.includes('palette')
  return <section className="workspace split-workspace"><div className="options-panel"><label className="field"><span>Color</span><input aria-label="Color" type="color" value={/^#[\da-f]{6}$/i.test(hex) ? hex : '#3B82F6'} onChange={(event) => { setHex(event.target.value); setError('') }}/></label><label className="field"><span>HEX value</span><input aria-label="HEX value" value={hex} onChange={(event) => setHex(event.target.value)} onBlur={validate}/></label>{error && <p className="field-error" role="alert">{error}</p>}</div><div className="result-card"><label className="counter-editor"><span>Color values</span><textarea aria-label="Color values" readOnly value={output}/></label>{palette && <div aria-label="Generated color palette" style={{ display: 'grid', gridTemplateColumns: `repeat(${swatches.length}, 1fr)` }}>{swatches.map((color) => <div key={color} title={color} style={{ background: color, minHeight: 72 }}><span className="badge">{color}</span></div>)}</div>}<div className="button-row"><CopyButton value={palette ? swatches.join('\n') : output}/><DownloadButton value={palette ? swatches.join('\n') : output} filename="colors.txt"/></div></div></section>
}
