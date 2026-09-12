import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { buildQrPayload, getQrKind, type QrCorrection, type QrFields, type QrKind } from './focused-workspace-utils'
import { downloadBlob, triggerDownload } from '@/lib/media/download'

const fieldsByKind: Record<QrKind, readonly [key: string, label: string, type?: string][]> = {
  text: [['text', 'Text']],
  url: [['url', 'URL', 'url']],
  wifi: [['ssid', 'Network name'], ['password', 'Password', 'password'], ['encryption', 'Security']],
  whatsapp: [['phone', 'Phone number', 'tel'], ['message', 'Message']],
  email: [['email', 'Email address', 'email'], ['subject', 'Subject'], ['body', 'Message']],
  phone: [['phone', 'Phone number', 'tel']],
  vcard: [['name', 'Full name'], ['organization', 'Organization'], ['phone', 'Phone number', 'tel'], ['email', 'Email address', 'email'], ['url', 'Website', 'url']],
  location: [['latitude', 'Latitude', 'number'], ['longitude', 'Longitude', 'number'], ['label', 'Label']],
}

function download(value: string, filename: string, type?: string) {
  if (value.startsWith('data:')) {
    triggerDownload(value, filename)
    return
  }
  downloadBlob(new Blob([value], type ? { type } : undefined), filename)
}

export function QrWorkspace({ tool }: { tool: ToolDefinition }) {
  const kind = getQrKind(tool.slug)
  const [fields, setFields] = useState<QrFields>({ encryption: 'WPA' })
  const [foreground, setForeground] = useState('#111111')
  const [background, setBackground] = useState('#ffffff')
  const [size, setSize] = useState(320)
  const [margin, setMargin] = useState(4)
  const [correction, setCorrection] = useState<QrCorrection>('M')
  const [png, setPng] = useState('')
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  async function generate() {
    const payload = buildQrPayload(kind, fields)
    if (!payload || (kind === 'wifi' && !fields.ssid) || (kind === 'location' && (!fields.latitude || !fields.longitude))) { setError('Complete the required QR fields.'); return }
    try {
      const qr = await import('qrcode')
      const options = { width: size, margin, errorCorrectionLevel: correction, color: { dark: foreground, light: background } }
      const [nextPng, nextSvg] = await Promise.all([qr.toDataURL(payload, options), qr.toString(payload, { ...options, type: 'svg' })])
      setPng(nextPng); setSvg(nextSvg); setError('')
    } catch (reason) { setPng(''); setSvg(''); setError(reason instanceof Error ? reason.message : 'The QR code could not be generated.') }
  }

  async function copyPng() {
    try {
      if (!png || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') throw new Error('PNG clipboard copy is not supported by this browser.')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': await (await fetch(png)).blob() })]); setCopyStatus('PNG copied')
    } catch (reason) { setCopyStatus(reason instanceof Error ? reason.message : 'Copy failed') }
  }
  async function copySvg() {
    try { await navigator.clipboard.writeText(svg); setCopyStatus('SVG copied') }
    catch { setCopyStatus('SVG copy failed') }
  }

  return <section className="workspace split-workspace">
    <div className="options-panel"><div className="panel-label">QR content</div><div className="field-grid">
      {fieldsByKind[kind].map(([key, label, type = 'text']) => key === 'encryption' ? <label className="field" key={key}><span>{label}</span><select value={fields[key] ?? 'WPA'} onChange={(event) => setFields({ ...fields, [key]: event.target.value })}><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">None</option></select></label> : <label className="field" key={key}><span>{label}</span><input aria-label={label} type={type} value={fields[key] ?? ''} onChange={(event) => setFields({ ...fields, [key]: event.target.value })}/></label>)}
      <label className="field"><span>Foreground</span><input aria-label="Foreground color" type="color" value={foreground} onChange={(event) => setForeground(event.target.value)}/></label>
      <label className="field"><span>Background</span><input aria-label="Background color" type="color" value={background} onChange={(event) => setBackground(event.target.value)}/></label>
      <label className="field"><span>Size</span><input aria-label="QR size" type="number" min="128" max="2048" value={size} onChange={(event) => setSize(event.target.valueAsNumber)}/></label>
      <label className="field"><span>Margin</span><input aria-label="QR margin" type="number" min="0" max="20" value={margin} onChange={(event) => setMargin(event.target.valueAsNumber)}/></label>
      <label className="field"><span>Error correction</span><select aria-label="Error correction" value={correction} onChange={(event) => setCorrection(event.target.value as QrCorrection)}><option value="L">Low</option><option value="M">Medium</option><option value="Q">Quartile</option><option value="H">High</option></select></label>
    </div><button className="button primary action-button" type="button" onClick={() => void generate()}>Generate QR code</button>{error && <p className="field-error" role="alert">{error}</p>}</div>
    <div className="result-card qr-result"><div className="panel-label">Preview</div>{png ? <img src={png} alt="Generated QR code" width={size} height={size}/> : <p>Configure and generate a QR code.</p>}{copyStatus && <p aria-live="polite">{copyStatus}</p>}<div className="button-row"><button className="button secondary" type="button" disabled={!png} onClick={() => download(png, 'qr-code.png')}>Download PNG</button><button className="button secondary" type="button" disabled={!png} onClick={() => void copyPng()}>Copy PNG</button><button className="button secondary" type="button" disabled={!svg} onClick={() => download(svg, 'qr-code.svg', 'image/svg+xml')}>Download SVG</button><button className="button secondary" type="button" disabled={!svg} onClick={() => void copySvg()}>Copy SVG</button></div></div>
  </section>
}
