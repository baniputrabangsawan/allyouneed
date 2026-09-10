import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { CopyButton, DownloadButton } from './workspace-ui'

export function CssWorkspace({ tool }: { tool: ToolDefinition }) {
  const [first, setFirst] = useState('#7C3AED'), [second, setSecond] = useState('#06B6D4')
  const [amount, setAmount] = useState(tool.slug === 'border-radius-generator' ? 24 : 16)
  const gradient = tool.slug === 'gradient-generator', radius = tool.slug === 'border-radius-generator'
  const css = gradient ? `background: linear-gradient(135deg, ${first}, ${second});` : radius ? `border-radius: ${amount}px;` : `box-shadow: 0 ${Math.round(amount / 2)}px ${amount * 2}px rgb(15 23 42 / 0.25);`
  return <section className="workspace split-workspace"><div className="options-panel">{gradient ? <><label className="field"><span>Start color</span><input aria-label="Start color" type="color" value={first} onChange={(event) => setFirst(event.target.value)}/></label><label className="field"><span>End color</span><input aria-label="End color" type="color" value={second} onChange={(event) => setSecond(event.target.value)}/></label></> : <label className="field"><span>{radius ? 'Radius' : 'Blur'}</span><input aria-label={radius ? 'Radius' : 'Blur'} type="range" min="0" max="100" value={amount} onChange={(event) => setAmount(Number(event.target.value))}/></label>}</div><div className="result-card"><div aria-label="CSS preview" style={{ width: '100%', minHeight: 180, background: gradient ? `linear-gradient(135deg, ${first}, ${second})` : '#fff', borderRadius: radius ? amount : 16, boxShadow: !gradient && !radius ? `0 ${Math.round(amount / 2)}px ${amount * 2}px rgb(15 23 42 / 0.25)` : undefined }}/><label className="counter-editor"><span>CSS</span><textarea aria-label="Generated CSS" readOnly value={css}/></label><div className="button-row"><CopyButton value={css}/><DownloadButton value={css} filename="style.css" type="text/css"/></div></div></section>
}
