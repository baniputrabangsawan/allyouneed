import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { CopyButton, DownloadButton } from './workspace-ui'
import { csvToJson, detectedDelimiter, jsonToCsv, type CsvDelimiter } from './csv-json'

type Mode = 'csv-json' | 'json-csv'

export function CsvJsonWorkspace({ tool }: { tool: ToolDefinition }) {
  const [mode, setMode] = useState<Mode>('csv-json')
  const [input, setInput] = useState('name,age\nJohn,25')
  const [output, setOutput] = useState('')
  const [preview, setPreview] = useState<string[][]>([])
  const [error, setError] = useState('')
  const [delimiter, setDelimiter] = useState<CsvDelimiter>('auto')
  const [header, setHeader] = useState(true)

  function run() {
    try {
      const result = mode === 'csv-json'
        ? csvToJson(input, { delimiter, header })
        : jsonToCsv(input, delimiter === 'auto' ? ',' : delimiter)
      setOutput(result.text)
      setPreview(result.preview)
      setError('')
    } catch (reason) {
      setOutput('')
      setPreview([])
      setError(reason instanceof Error ? reason.message : 'Conversion failed.')
    }
  }

  function clear() {
    setInput('')
    setOutput('')
    setPreview([])
    setError('')
  }

  async function loadFile(file: File) {
    setInput(await file.text())
  }

  const actualDelimiter = mode === 'csv-json' && delimiter === 'auto' && input ? detectedDelimiter(input) : delimiter

  return (
    <section className="workspace split-workspace" aria-label={tool.name}>
      <div className="options-panel">
        <div className="panel-label"><span>Input</span></div>
        <div className="segmented" role="group" aria-label="Conversion mode">
          <button type="button" className={mode === 'csv-json' ? 'active' : ''} onClick={() => setMode('csv-json')}>CSV to JSON</button>
          <button type="button" className={mode === 'json-csv' ? 'active' : ''} onClick={() => setMode('json-csv')}>JSON to CSV</button>
        </div>
        <div className="field-grid">
          <label className="field"><span>Delimiter</span><select value={delimiter} onChange={(event) => setDelimiter(event.target.value as CsvDelimiter)}><option value="auto">Auto</option><option value=",">Comma</option><option value=";">Semicolon</option><option value="\t">Tab</option></select></label>
          {mode === 'csv-json' ? <label className="field"><span>First row</span><select value={header ? 'headers' : 'data'} onChange={(event) => setHeader(event.target.value === 'headers')}><option value="headers">Headers</option><option value="data">Data row</option></select></label> : null}
        </div>
        {mode === 'csv-json' ? <label className="field"><span>CSV file optional</span><input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file) }} /></label> : null}
        <label className="counter-editor"><span>{mode === 'csv-json' ? 'CSV input' : 'JSON input'}</span><textarea spellCheck={false} value={input} onChange={(event) => setInput(event.target.value)} /></label>
        {actualDelimiter && actualDelimiter !== 'auto' ? <p className="option-help">Delimiter: {actualDelimiter === '\t' ? 'tab' : actualDelimiter}</p> : null}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <div className="button-row"><button className="button primary" type="button" onClick={run}>Convert</button><button className="button secondary" type="button" onClick={clear}>Clear</button></div>
      </div>
      <div className="result-card">
        <div className="panel-label"><span>Output</span></div>
        <label className="counter-editor"><span>{mode === 'csv-json' ? 'JSON output' : 'CSV output'}</span><textarea readOnly spellCheck={false} value={output} placeholder="Converted output appears here" /></label>
        {preview.length ? <div className="csv-preview"><strong>Preview</strong><table><tbody>{preview.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div> : null}
        <div className="button-row"><CopyButton value={output} /><DownloadButton value={output} filename={mode === 'csv-json' ? 'converted.json' : 'converted.csv'} type={mode === 'csv-json' ? 'application/json' : 'text/csv'} /></div>
      </div>
    </section>
  )
}
