import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { countText } from './focused-workspace-utils'

export function WordCounterWorkspace({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState('')
  const counts = countText(input)
  return <section className="workspace compact-workspace">
    <label className="counter-editor"><span>Text</span><textarea aria-label="Text to count" value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Enter text for ${tool.name.toLowerCase()}`}/></label>
    <div className="counter-stats" aria-live="polite">
      <div><strong>{counts.words}</strong><span>Words</span></div>
      <div><strong>{counts.characters}</strong><span>Characters</span></div>
      <div><strong>{counts.charactersWithoutSpaces}</strong><span>Without spaces</span></div>
      <div><strong>{counts.lines}</strong><span>Lines</span></div>
    </div>
  </section>
}
