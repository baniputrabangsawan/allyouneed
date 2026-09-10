import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { transformText, type TextCase } from './workspace-utils'
import { CopyButton, DownloadButton, TextPanels } from './workspace-ui'

export function GenericTextWorkspace({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState(tool.slug === 'lorem-ipsum-generator' ? '3' : '')
  const [second, setSecond] = useState('')
  const [output, setOutput] = useState('')
  const [textCase, setTextCase] = useState<TextCase>('upper')
  const compares = tool.slug === 'text-compare' || tool.slug === 'text-diff'
  const htmlOutput = tool.slug === 'markdown-preview' || tool.slug === 'markdown-to-html'
  function run() { setOutput(transformText(tool.slug, input, second, textCase)) }
  return <TextPanels input={input} output={output} onInput={setInput} {...(compares ? { second, onSecond: setSecond } : {})} inputLabel={tool.slug === 'lorem-ipsum-generator' ? 'Paragraph count' : 'Input text'} outputLabel={htmlOutput ? 'Safe HTML source (not rendered)' : 'Result'}>
    {tool.slug === 'case-converter' && <label>Case <select aria-label="Case style" value={textCase} onChange={(event) => setTextCase(event.target.value as TextCase)}><option value="upper">UPPERCASE</option><option value="lower">lowercase</option><option value="title">Title Case</option><option value="sentence">Sentence case</option></select></label>}
    <button className="button primary" type="button" onClick={run}>Run {tool.name}</button><CopyButton value={output}/><DownloadButton value={output} filename={htmlOutput ? 'result.html' : 'result.txt'} type={htmlOutput ? 'text/html' : 'text/plain'}/>
  </TextPanels>
}
