import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { jsonToYaml, yamlToJson } from './yaml-utils'
import { CopyButton, DownloadButton, TextPanels } from './workspace-ui'

export function YamlWorkspace({ tool }: { tool: ToolDefinition }) {
  const toYaml = tool.slug === 'json-to-yaml'
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  function convert() {
    try {
      setOutput(toYaml ? jsonToYaml(input) : yamlToJson(input))
      setError('')
    } catch (reason) {
      setOutput('')
      setError(reason instanceof Error ? reason.message : 'The input could not be converted.')
    }
  }

  function clear() {
    setInput('')
    setOutput('')
    setError('')
  }

  return <TextPanels
    input={input}
    output={output}
    onInput={setInput}
    inputLabel={toYaml ? 'JSON input' : 'YAML input'}
    outputLabel={toYaml ? 'YAML result' : 'JSON result'}
    error={error}
  >
    <button className="button primary" type="button" onClick={convert}>Convert</button>
    <CopyButton value={output}/>
    <DownloadButton
      value={output}
      filename={toYaml ? 'result.yaml' : 'result.json'}
      type={toYaml ? 'text/yaml' : 'application/json'}
    />
    <button className="button secondary" type="button" onClick={clear}>Clear</button>
  </TextPanels>
}
