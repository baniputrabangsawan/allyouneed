import { LoaderCircle, Square } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../i18n'
import { API_BASE_URL } from '../../lib/api/client'
import { cancelJob, createJob, getJob, getJobResult } from '../../lib/api/jobs'
import type { Job } from '../../lib/api/types'
import { remoteJobPhase } from '../../lib/media/job-phase'
import { errorFromJob, workflowErrorCode, workflowMessage, type WorkflowErrorCode } from '../../lib/media/workflow-error'
import { ImageResultPreview } from './ImageResultPreview'
import type { ToolDefinition } from '../tools/tool-registry'

const DEFAULT_HTML = '<div class="box">Kits</div>'
const DEFAULT_CSS = '.box { width: 200px; height: 80px; background: #c00; color: #fff; font: 24px sans-serif; display: grid; place-items: center; }'

type Format = 'png' | 'jpeg'

export function HtmlToImageWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const [html, setHtml] = useState(DEFAULT_HTML)
  const [css, setCss] = useState(DEFAULT_CSS)
  const [width, setWidth] = useState(320)
  const [height, setHeight] = useState(180)
  const [format, setFormat] = useState<Format>('png')
  const [job, setJob] = useState<Job | null>(null)
  const [download, setDownload] = useState<{ url: string; filename: string } | null>(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState<WorkflowErrorCode | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    if (!html.trim() || busy) return
    setError('')
    setErrorCode(null)
    setDownload(null)
    setPreview('')
    setBusy(true)
    try {
      let current = await createJob({
        toolId: tool.id,
        input: {},
        options: { html, css, width, height, format },
      })
      setJob(current)
      while (!['completed', 'failed', 'cancelled', 'expired'].includes(current.status)) {
        await new Promise((resolve) => window.setTimeout(resolve, 500))
        current = await getJob(current.jobId)
        setJob(current)
      }
      if (current.status === 'completed') {
        const result = await getJobResult<{ downloadUrl: string; filename: string }>(current.jobId)
        const url = `${API_BASE_URL}${result.result.downloadUrl}`
        setDownload({ url, filename: result.result.filename })
        setPreview(url)
      } else if (current.status === 'failed') {
        const failed = errorFromJob(current.error)
        setErrorCode(workflowErrorCode(failed))
        setError(workflowMessage(failed, copy.errors))
      }
    } catch (reason) {
      setErrorCode(workflowErrorCode(reason))
      setError(workflowMessage(reason, copy.errors))
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    if (job) setJob(await cancelJob(job.jobId))
    setBusy(false)
  }

  const processing = busy || job?.status === 'queued' || job?.status === 'processing'
  const phase = remoteJobPhase(busy ? 'processing' : 'idle', job, errorCode)
  const phaseLabel = {
    ready: copy.workspace.ready,
    uploading: copy.jobs.uploading,
    queued: copy.jobs.queued,
    processing: copy.jobs.processing,
    completed: copy.jobs.completed,
    failed: copy.jobs.failed,
    cancelled: copy.jobs.cancelled,
    unavailable: copy.jobs.unavailable,
  }[phase]
  return (
    <section className="workspace split-workspace">
      <div className="options-panel">
        <label className="field">
          <span>HTML</span>
          <textarea aria-label="HTML" rows={8} spellCheck={false} value={html} onChange={(event) => setHtml(event.target.value)} />
        </label>
        <label className="field">
          <span>CSS (optional)</span>
          <textarea aria-label="CSS" rows={5} spellCheck={false} value={css} onChange={(event) => setCss(event.target.value)} />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>Width</span>
            <input aria-label="Viewport width" type="number" min={1} max={4096} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
          </label>
          <label className="field">
            <span>Height</span>
            <input aria-label="Viewport height" type="number" min={1} max={4096} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
          </label>
        </div>
        <label className="field">
          <span>Format</span>
          <select aria-label="Output format" value={format} onChange={(event) => setFormat(event.target.value as Format)}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </label>
        <p className="option-help">HTML is rendered on the server in an isolated browser. External URLs and local files are blocked.</p>
        <div className="button-row">
          <button className="button primary" type="button" disabled={!html.trim() || processing} onClick={() => void run()}>
            {processing && <LoaderCircle size={17} />} Process
          </button>
          {processing && (
            <button className="button secondary" type="button" onClick={() => void stop()}>
              <Square size={15} /> Cancel
            </button>
          )}
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      <div className="result-card">
        <div className="panel-label">
          <span>Job status</span>
          <span className={`badge badge-${phase}`}>{phaseLabel}</span>
        </div>
        {phase === 'unavailable' && <p className="field-error" role="alert">{copy.errors.apiUnreachable}</p>}
        {job && (phase === 'processing' || phase === 'queued' || phase === 'completed') && (
          <>
            <p>{job.stage ?? phaseLabel}</p>
            <progress max="100" value={job.progress ?? (phase === 'completed' ? 100 : undefined)} />
          </>
        )}
        <ImageResultPreview
          resultSrc={preview || undefined}
          compare={false}
          checkerboard={format === 'png'}
          processing={processing}
          failed={phase === 'failed'}
          resultAlt="Rendered HTML"
          downloadId={job?.jobId}
          downloadSource={download?.url}
          downloadFilename={download?.filename}
          meta={download ? { filename: download.filename, mime: format === 'png' ? 'image/png' : 'image/jpeg', width, height } : undefined}
        />
      </div>
    </section>
  )
}
