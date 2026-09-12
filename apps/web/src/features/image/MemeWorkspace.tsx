import { FileImage, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ImageResultPreview } from '@/features/image/ImageResultPreview'
import { SharedImageUpload } from '@/features/image/SharedImageUpload'
import { ProcessingProgressPanel } from '@/features/workspaces/processing-progress'
import { useImageProcessor } from '@/processing/client/use-image-processor'
import {
  addMemeLayer,
  createMemeLayer,
  defaultMemeLayers,
  hasMemeText,
  MEME_ACCEPT,
  MEME_FONTS,
  MEME_FORMATS,
  removeMemeLayer,
  resolveMemeFont,
  setMemeCaption,
  updateMemeLayer,
  type MemeAlign,
  type MemeFormat,
  type MemeTextLayer,
} from '@/features/image/meme-utils'
import { formatBytes, outputFilename } from '@/lib/format'
import { type ImageOptimizeMode } from '@/processing/client/image-optimize'

interface MemeResult {
  id: string
  blob: Blob
  url: string
  durationMs: number
  width: number
  height: number
  originalSize: number
  optimizedSize: number
  recommendWebp: boolean
}

const formatLabels: Record<MemeFormat, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
}

export function MemeWorkspace() {
  const sourceUrlRef = useRef('')
  const resultUrlRef = useRef('')
  const boardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const selectionRef = useRef(0)
  const runningRef = useRef(false)
  const processor = useImageProcessor()
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [result, setResult] = useState<MemeResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'ready' | 'processing' | 'completed' | 'failed'>('idle')
  const [error, setError] = useState('')
  const [naturalWidth, setNaturalWidth] = useState(0)
  const [naturalHeight, setNaturalHeight] = useState(0)
  const [boardWidth, setBoardWidth] = useState(0)
  const [layers, setLayers] = useState<MemeTextLayer[]>(() => defaultMemeLayers())
  const [selectedId, setSelectedId] = useState('top')
  const [format, setFormat] = useState<MemeFormat>('image/png')
  const [quality, setQuality] = useState(92)
  const [autoOptimize, setAutoOptimize] = useState(true)
  const [optimizeMode, setOptimizeMode] = useState<ImageOptimizeMode>('auto')

  useEffect(() => () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
  }, [])

  useEffect(() => {
    const node = boardRef.current
    if (!node) return
    const update = () => setBoardWidth(node.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [file])

  function clearResult() {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = ''
    setResult(null)
  }

  function discardRenderedMeme() {
    if (!resultUrlRef.current && status !== 'completed' && status !== 'failed') return
    clearResult()
    setStatus(file ? 'ready' : 'idle')
    setError('')
  }

  function replaceLayers(next: MemeTextLayer[] | ((current: MemeTextLayer[]) => MemeTextLayer[])) {
    setLayers(next)
    discardRenderedMeme()
  }

  function resetSettings() {
    replaceLayers(defaultMemeLayers(naturalWidth > 0 ? { width: naturalWidth, height: naturalHeight } : undefined))
    setSelectedId('top')
    setFormat('image/png')
    setQuality(92)
    setAutoOptimize(true)
    setOptimizeMode('auto')
  }

  function removeFile() {
    selectionRef.current += 1
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    sourceUrlRef.current = ''
    setSourceUrl('')
    setFile(null)
    setNaturalWidth(0)
    setNaturalHeight(0)
    setLayers(defaultMemeLayers())
    setSelectedId('top')
    clearResult()
    setStatus('idle')
    setError('')
  }

  async function chooseFile(next: File) {
    selectionRef.current += 1
    const selection = selectionRef.current
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    clearResult()
    const nextUrl = URL.createObjectURL(next)
    sourceUrlRef.current = nextUrl
    setFile(next)
    setSourceUrl(nextUrl)
    setStatus('ready')
    setError('')
    try {
      const bitmap = await createImageBitmap(next)
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      if (selection !== selectionRef.current) return
      setNaturalWidth(size.width)
      setNaturalHeight(size.height)
      setLayers(defaultMemeLayers(size))
      setSelectedId('top')
    } catch {
      if (selection !== selectionRef.current) return
      setStatus('failed')
      setError('This image could not be read.')
    }
  }

  function patchLayer(id: string, patch: Partial<MemeTextLayer>) {
    replaceLayers((current) => updateMemeLayer(current, id, patch))
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, layer: MemeTextLayer) {
    const board = boardRef.current
    if (!board || event.button !== 0) return
    event.preventDefault()
    const rect = board.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    dragRef.current = {
      id: layer.id,
      dx: event.clientX - rect.left - layer.x * rect.width,
      dy: event.clientY - rect.top - layer.y * rect.height,
    }
    setSelectedId(layer.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    const board = boardRef.current
    if (!drag || !board) return
    const rect = board.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    const x = (event.clientX - rect.left - drag.dx) / rect.width
    const y = (event.clientY - rect.top - drag.dy) / rect.height
    replaceLayers((current) => updateMemeLayer(current, drag.id, { x, y }))
  }

  function endDrag() {
    dragRef.current = null
  }

  async function run() {
    if (!file || !hasMemeText(layers) || runningRef.current) return
    runningRef.current = true
    const selection = selectionRef.current
    setStatus('processing')
    setError('')
    const startedAt = performance.now()
    try {
      const output = await processor.run({
        op: 'renderMeme',
        file,
        layers,
        format,
        quality: quality / 100,
        optimize: { enabled: autoOptimize, mode: optimizeMode },
      })
      if (selection !== selectionRef.current) return
      clearResult()
      const url = URL.createObjectURL(output.blob)
      resultUrlRef.current = url
      setResult({
        id: crypto.randomUUID(),
        blob: output.blob,
        url,
        durationMs: performance.now() - startedAt,
        width: output.width,
        height: output.height,
        originalSize: output.originalSize,
        optimizedSize: output.optimizedSize,
        recommendWebp: output.recommendWebp,
      })
      setStatus('completed')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Meme rendering failed.')
      setStatus('failed')
      processor.setStage('failed')
    } finally {
      runningRef.current = false
    }
  }

  const selected = layers.find((layer) => layer.id === selectedId) ?? layers[0]
  const extension = format === 'image/jpeg' ? 'jpg' : 'png'
  const scale = naturalWidth > 0 && boardWidth > 0 ? boardWidth / naturalWidth : 1
  const savedPercent = result && result.originalSize > 0
    ? Math.round((1 - result.optimizedSize / result.originalSize) * 100)
    : 0

  return (
    <section className="workspace">
      {!file ? (
        <SharedImageUpload accept={MEME_ACCEPT} files={[]} onFilesSelected={(files) => { const next = files[0]; if (next) void chooseFile(next) }} onRemove={removeFile} />
      ) : (
        <div className="image-workspace">
          <div className="preview-panel">
            <div className="panel-label">
              <span>Editor</span>
              <button type="button" className="text-button" onClick={removeFile}><Trash2 size={15}/> Remove</button>
            </div>
            <div className="image-stage">
              <div ref={boardRef} className="meme-board">
                <img src={sourceUrl} alt="Selected meme image"/>
                {layers.map((layer) => {
                  const font = resolveMemeFont(layer.fontFamily)
                  const align = layer.align
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      className={`meme-layer${selectedId === layer.id ? ' selected' : ''}`}
                      aria-label={`${layer.role === 'top' ? 'Top' : layer.role === 'bottom' ? 'Bottom' : 'Text'} layer`}
                      style={{
                        left: `${layer.x * 100}%`,
                        top: `${layer.y * 100}%`,
                        width: `${layer.maxWidth * 100}%`,
                        color: layer.fill,
                        fontSize: `${Math.max(10, layer.fontSize * scale)}px`,
                        fontFamily: font.stack,
                        textAlign: align,
                        WebkitTextStroke: layer.strokeWidth > 0 ? `${Math.max(1, layer.strokeWidth * scale)}px ${layer.stroke}` : '0',
                        transform: align === 'left' ? 'translate(0, -50%)' : align === 'right' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)',
                      }}
                      onPointerDown={(event) => startDrag(event, layer)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    >
                      {layer.text.trim() ? layer.text : layer.role === 'top' ? 'TOP TEXT' : layer.role === 'bottom' ? 'BOTTOM TEXT' : 'TEXT'}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="file-summary">
              <FileImage size={20}/>
              <span>
                <strong>{file.name}</strong>
                <small>
                  {formatBytes(file.size)}
                  {naturalWidth ? ` · ${naturalWidth}×${naturalHeight}` : ''}
                </small>
              </span>
            </div>
          </div>
          <div className="options-panel">
            <div className="panel-label">
              <span>Settings</span>
              <button type="button" className="text-button" onClick={resetSettings}><RefreshCcw size={14}/> Reset</button>
            </div>
            <p className="option-help">Editing stays in this browser. The image is never uploaded. Generate writes a separate canvas file.</p>
            <Field label="Top text">
              <input aria-label="Top text" value={layers.find((layer) => layer.role === 'top')?.text ?? ''} onChange={(event) => replaceLayers((current) => setMemeCaption(current, 'top', event.target.value))}/>
            </Field>
            <Field label="Bottom text">
              <input aria-label="Bottom text" value={layers.find((layer) => layer.role === 'bottom')?.text ?? ''} onChange={(event) => replaceLayers((current) => setMemeCaption(current, 'bottom', event.target.value))}/>
            </Field>
            <div className="panel-label"><span>Text layers</span></div>
            <div className="meme-layer-list">
              {layers.map((layer) => (
                <button key={layer.id} type="button" className={selectedId === layer.id ? 'active' : ''} onClick={() => setSelectedId(layer.id)}>
                  <span>{layer.role === 'top' ? 'Top' : layer.role === 'bottom' ? 'Bottom' : 'Layer'} · {layer.text.trim() || 'Empty'}</span>
                </button>
              ))}
            </div>
            <div className="button-row meme-layer-actions">
              <button className="button ghost" type="button" onClick={() => {
                const layer = createMemeLayer({ text: '', y: 0.5, fontSize: selected?.fontSize ?? 48 })
                replaceLayers((current) => addMemeLayer(current, layer))
                setSelectedId(layer.id)
              }}><Plus size={15}/> Add text layer</button>
              {selected && !selected.role && (
                <button className="button ghost" type="button" onClick={() => {
                  replaceLayers((current) => removeMemeLayer(current, selected.id))
                  setSelectedId('top')
                }}><Trash2 size={15}/> Remove layer</button>
              )}
            </div>
            {selected && (
              <>
                <Field label="Text">
                  <textarea aria-label="Layer text" rows={3} value={selected.text} onChange={(event) => patchLayer(selected.id, { text: event.target.value })}/>
                </Field>
                <Field label="Font">
                  <select aria-label="Font family" value={selected.fontFamily} onChange={(event) => patchLayer(selected.id, { fontFamily: event.target.value as MemeTextLayer['fontFamily'] })}>
                    {MEME_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}
                  </select>
                </Field>
                <Field label="Size" value={`${selected.fontSize}px`}>
                  <input aria-label="Font size" type="range" min="12" max="240" value={selected.fontSize} onChange={(event) => patchLayer(selected.id, { fontSize: Number(event.target.value) })}/>
                </Field>
                <div className="field-grid">
                  <Field label="Fill">
                    <input aria-label="Fill color" type="color" value={selected.fill} onChange={(event) => patchLayer(selected.id, { fill: event.target.value })}/>
                  </Field>
                  <Field label="Stroke">
                    <input aria-label="Stroke color" type="color" value={selected.stroke} onChange={(event) => patchLayer(selected.id, { stroke: event.target.value })}/>
                  </Field>
                </div>
                <Field label="Stroke width" value={`${selected.strokeWidth}px`}>
                  <input aria-label="Stroke width" type="range" min="0" max="24" value={selected.strokeWidth} onChange={(event) => patchLayer(selected.id, { strokeWidth: Number(event.target.value) })}/>
                </Field>
                <Field label="Alignment">
                  <select aria-label="Alignment" value={selected.align} onChange={(event) => patchLayer(selected.id, { align: event.target.value as MemeAlign })}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </Field>
                <div className="field-grid">
                  <Field label="X" value={`${Math.round(selected.x * 100)}%`}>
                    <input aria-label="Layer X" type="range" min="0" max="100" value={Math.round(selected.x * 100)} onChange={(event) => patchLayer(selected.id, { x: Number(event.target.value) / 100 })}/>
                  </Field>
                  <Field label="Y" value={`${Math.round(selected.y * 100)}%`}>
                    <input aria-label="Layer Y" type="range" min="0" max="100" value={Math.round(selected.y * 100)} onChange={(event) => patchLayer(selected.id, { y: Number(event.target.value) / 100 })}/>
                  </Field>
                </div>
                <p className="option-help">Drag a caption on the image to reposition it. X and Y are stored separately from the exported file.</p>
              </>
            )}
            <Field label="Export format">
              <select aria-label="Export format" value={format} onChange={(event) => { setFormat(event.target.value as MemeFormat); clearResult(); setStatus('ready') }}>
                {MEME_FORMATS.map((value) => <option key={value} value={value}>{formatLabels[value]}</option>)}
              </select>
            </Field>
            {format === 'image/jpeg' && (
              <Field label="Quality" value={`${quality}%`}>
                <input aria-label="JPEG quality" type="range" min="40" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))}/>
              </Field>
            )}
            <label className="check-row">
              <input type="checkbox" checked={autoOptimize} onChange={(event) => { setAutoOptimize(event.target.checked); discardRenderedMeme() }}/>
              Auto optimize output
            </label>
            {autoOptimize && (
              <div className="segmented" role="group" aria-label="Auto optimize output">
                {(['auto', 'lossless', 'strong'] as const).map((value) => (
                  <button key={value} type="button" className={optimizeMode === value ? 'active' : ''} aria-pressed={optimizeMode === value} onClick={() => { setOptimizeMode(value); discardRenderedMeme() }}>
                    {value === 'auto' ? 'Auto' : value === 'lossless' ? 'Lossless' : 'Strong'}
                  </button>
                ))}
              </div>
            )}
            {status === 'processing' && <ProcessingProgressPanel stage={processor.stage} title="Processing image..." percent={processor.percent} />}
            {status === 'failed' && <ProcessingProgressPanel stage="failed" title="Processing failed" detail={error || 'Processing failed'} />}
            <button className={`button ${status === 'completed' ? 'success' : 'primary'} action-button`} type="button" disabled={status === 'processing' || !hasMemeText(layers)} onClick={() => void run()}>
              {status === 'processing' ? 'Rendering...' : status === 'completed' ? 'Generate again' : status === 'failed' ? 'Try again' : 'Generate meme'}
            </button>
            {error && status !== 'failed' && <p className="field-error" role="alert">{error}</p>}
            {result && (
              <ImageResultPreview
                originalSrc={sourceUrl}
                resultSrc={result.url}
                checkerboard={format === 'image/png'}
                resultAlt="Rendered meme"
                downloadId={result.id}
                downloadSource={result.blob}
                downloadFilename={outputFilename(file.name, 'meme', extension)}
                meta={{ filename: outputFilename(file.name, 'meme', extension), mime: format, width: result.width, height: result.height, size: result.blob.size, originalSize: result.originalSize, savedPct: savedPercent, durationMs: result.durationMs }}
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return <label className="field"><span>{label}{value && <small>{value}</small>}</span>{children}</label>
}
