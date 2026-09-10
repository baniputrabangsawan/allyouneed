import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { processJson, type JsonAction } from './focused-workspace-utils'
import { CopyButton, DownloadButton, TextPanels } from './workspace-ui'

export function JsonWorkspace({ tool }: { tool: ToolDefinition }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const action: JsonAction = tool.slug === 'json-validator' ? 'validate' : tool.slug === 'json-minifier' ? 'minify' : 'format'

  function run() {
    try {
      setOutput(processJson(input, action))
      setError('')
    } catch (reason) {
      setOutput('')
      setError(reason instanceof SyntaxError ? reason.message : 'The JSON could not be processed.')
    }
  }

  return <TextPanels input={input} output={output} onInput={setInput} inputLabel="JSON input" outputLabel={action === 'validate' ? 'Validation result' : 'JSON result'} error={error}>
    <button className="button primary" type="button" onClick={run}>{tool.name}</button>
    <CopyButton value={output}/>
    <DownloadButton value={output} filename={action === 'validate' ? 'validation.txt' : 'result.json'} type={action === 'validate' ? 'text/plain' : 'application/json'}/>
  </TextPanels>
}
