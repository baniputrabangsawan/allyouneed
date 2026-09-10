import { Download, FileImage, RefreshCcw, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FileDropzone } from '@/components/file/FileDropzone'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import { formatBytes, outputFilename } from '@/lib/format'
import { processImage, type ImageFormat, type WatermarkPosition } from '@/processing/client/image'

type ImageMode = 'compress' | 'resize' | 'transform' | 'converter' | 'watermark' | 'metadata'
type ResizeUnit = 'pixels' | 'percent'

interface ImageResult {
  blob: Blob
  url: string
  durationMs: number
}

const supportedFormats: readonly ImageFormat[] = ['image/jpeg', 'image/png', 'image/webp']
const defaultAccept = [...supportedFormats, 'image/avif']
const fixedFormats: Readonly<Partial<Record<string, ImageFormat>>> = {
  'convert-to-jpg': 'image/jpeg',
  'jpg-to-png': 'image/png',
  'png-to-jpg': 'image/jpeg',
  'jpg-to-webp': 'image/webp',
  'png-to-webp': 'image/webp',
  'webp-to-jpg': 'image/jpeg',
}
const formatLabels: Readonly<Record<ImageFormat, string>> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
}
const positions: readonly WatermarkPosition[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

function getMode(slug: string): ImageMode {
  if (slug === 'compress-image') return 'compress'
  if (slug === 'resize-image') return 'resize'
  if (slug === 'rotate-image' || slug === 'flip-image') return 'transform'
  if (slug === 'watermark-image') return 'watermark'
  if (slug === 'remove-metadata') return 'metadata'
  return 'converter'
}

function sourceFormat(file: File): ImageFormat {
  return supportedFormats.includes(file.type as ImageFormat) ? file.type as ImageFormat : 'image/webp'
}

function initialFormat(tool: ToolDefinition, file?: File): ImageFormat {
  const fixed = fixedFormats[tool.slug]
  if (fixed) return fixed
  if (tool.slug === 'convert-from-jpg') return 'image/png'
  if (getMode(tool.slug) === 'converter') return 'image/jpeg'
  return file ? sourceFormat(file) : 'image/jpeg'
}

function inputFormats(tool: ToolDefinition): readonly string[] {
  if (tool.slug.startsWith('jpg-to-') || tool.slug === 'convert-from-jpg') return ['image/jpeg']
  if (tool.slug.startsWith('png-to-')) return ['image/png']
  if (tool.slug.startsWith('webp-to-')) return ['image/webp']
  return tool.acceptedFormats ?? defaultAccept
}

export function ImageWorkspace({ tool }: { tool: ToolDefinition }) {
  const mode = getMode(tool.slug)
  const sourceUrlRef = useRef('')
  const resultUrlRef = useRef('')
  const selectionRef = useRef(0)
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [result, setResult] = useState<ImageResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'ready' | 'processing' | 'completed' | 'failed'>('idle')
  const [error, setError] = useState('')
  const [naturalWidth, setNaturalWidth] = useState(0)
  const [naturalHeight, setNaturalHeight] = useState(0)
  const [format, setFormat] = useState<ImageFormat>(() => initialFormat(tool))
  const [quality, setQuality] = useState(mode === 'compress' ? 80 : 90)
  const [width, setWidth] = useState(1200)
  const [height, setHeight] = useState(800)
  const [resizeUnit, setResizeUnit] = useState<ResizeUnit>('pixels')
  const [widthPercent, setWidthPercent] = useState(100)
  const [heightPercent, setHeightPercent] = useState(100)
  const [lockAspectRatio, setLockAspectRatio] = useState(true)
  const [rotation, setRotation] = useState(tool.slug === 'rotate-image' ? 90 : 0)
  const [flipX, setFlipX] = useState(tool.slug === 'flip-image')
  const [flipY, setFlipY] = useState(false)
  const [watermark, setWatermark] = useState('Kits')
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottom-right')
  const [watermarkOpacity, setWatermarkOpacity] = useState(75)
  const [watermarkSize, setWatermarkSize] = useState(48)
  const [watermarkPadding, setWatermarkPadding] = useState(24)
  const [watermarkRotation, setWatermarkRotation] = useState(0)

  useEffect(() => () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
  }, [])

  function clearResult() {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = ''
    setResult(null)
  }

  function resetSettings(currentFile = file) {
    clearResult()
    setFormat(initialFormat(tool, currentFile ?? undefined))
    setQuality(mode === 'compress' ? 80 : 90)
    setWidth(naturalWidth || 1200)
    setHeight(naturalHeight || 800)
    setResizeUnit('pixels')
    setWidthPercent(100)
    setHeightPercent(100)
    setLockAspectRatio(true)
    setRotation(tool.slug === 'rotate-image' ? 90 : 0)
    setFlipX(tool.slug === 'flip-image')
    setFlipY(false)
    setWatermark('Kits')
    setWatermarkPosition('bottom-right')
    setWatermarkOpacity(75)
    setWatermarkSize(48)
    setWatermarkPadding(24)
    setWatermarkRotation(0)
    setStatus(currentFile ? 'ready' : 'idle')
    setError('')
  }

  function removeFile() {
    selectionRef.current += 1
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    sourceUrlRef.current = ''
    setSourceUrl('')
    setFile(null)
    setNaturalWidth(0)
    setNaturalHeight(0)
    resetSettings(null)
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
    setFormat(initialFormat(tool, next))
    setStatus('ready')
    setError('')
    try {
      const bitmap = await createImageBitmap(next)
      const nextWidth = bitmap.width
      const nextHeight = bitmap.height
      bitmap.close()
      if (selection !== selectionRef.current) return
      setNaturalWidth(nextWidth)
      setNaturalHeight(nextHeight)
      setWidth(nextWidth)
      setHeight(nextHeight)
      setWidthPercent(100)
      setHeightPercent(100)
    } catch {
      if (selection !== selectionRef.current) return
      setStatus('failed')
      setError('This image could not be read.')
    }
  }

  function updateWidth(next: number) {
    setWidth(next)
    if (lockAspectRatio && naturalWidth > 0) setHeight(Math.max(1, Math.round(next * naturalHeight / naturalWidth)))
  }

  function updateHeight(next: number) {
    setHeight(next)
    if (lockAspectRatio && naturalHeight > 0) setWidth(Math.max(1, Math.round(next * naturalWidth / naturalHeight)))
  }

  function updateWidthPercent(next: number) {
    setWidthPercent(next)
    if (lockAspectRatio) setHeightPercent(next)
  }

  function updateHeightPercent(next: number) {
    setHeightPercent(next)
    if (lockAspectRatio) setWidthPercent(next)
  }

  async function run() {
    if (!file) return
    const selection = selectionRef.current
    setStatus('processing')
    setError('')
    const startedAt = performance.now()
    try {
      const outputWidth = resizeUnit === 'percent' ? Math.max(1, Math.round(naturalWidth * widthPercent / 100)) : width
      const outputHeight = resizeUnit === 'percent' ? Math.max(1, Math.round(naturalHeight * heightPercent / 100)) : height
      const blob = await processImage(file, {
        format,
        quality: quality / 100,
        ...(format === 'image/jpeg' ? { backgroundColor: '#fff' } : {}),
        ...(mode === 'resize' ? { width: outputWidth, height: outputHeight } : {}),
        ...(mode === 'transform' ? { rotation, flipX, flipY } : {}),
        ...(mode === 'watermark' ? {
          watermark,
          watermarkPosition,
          watermarkOpacity: watermarkOpacity / 100,
          watermarkSize,
          watermarkPadding,
          watermarkRotation,
        } : {}),
      })
      if (selection !== selectionRef.current) return
      clearResult()
      const url = URL.createObjectURL(blob)
      resultUrlRef.current = url
      setResult({ blob, url, durationMs: performance.now() - startedAt })
      setStatus('completed')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image processing failed.')
      setStatus('failed')
    }
  }

  const selectableFormats: readonly ImageFormat[] = tool.slug === 'convert-from-jpg'
    ? ['image/png', 'image/webp']
    : supportedFormats
  const showFormat = mode === 'converter' && !fixedFormats[tool.slug]
  const showQuality = (mode === 'compress' || mode === 'converter') && format !== 'image/png'
  const action = mode === 'compress' ? 'Compress image' : mode === 'resize' ? 'Resize image' : mode === 'transform' ? 'Apply transform' : mode === 'converter' ? 'Convert image' : mode === 'watermark' ? 'Add watermark' : 'Remove metadata'
  const suffix = mode === 'compress' ? 'compressed' : mode === 'resize' ? 'resized' : mode === 'transform' ? (tool.slug === 'flip-image' ? 'flipped' : 'rotated') : mode === 'watermark' ? 'watermarked' : mode === 'metadata' ? 'clean' : 'converted'
  const extension = format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp'
  const savings = result && file && file.size > 0 ? Math.round((1 - result.blob.size / file.size) * 100) : null

  return <section className="workspace">{!file ? <FileDropzone accept={inputFormats(tool)} onFileSelected={chooseFile}/> : <div className="image-workspace"><div className="preview-panel"><div className="panel-label"><span>Preview</span><button type="button" className="text-button" onClick={removeFile}><Trash2 size={15}/> Remove</button></div><div className="image-stage"><img src={result?.url ?? sourceUrl} alt={result ? 'Processed result' : 'Selected input'}/></div><div className="file-summary"><FileImage size={20}/><span><strong>{file.name}</strong><small>{formatBytes(file.size)}{result ? ` -> ${formatBytes(result.blob.size)} · ${savings !== null && savings >= 0 ? `${savings}% saved` : `${Math.abs(savings ?? 0)}% larger`} · ${Math.round(result.durationMs)} ms` : ''}</small></span></div></div><div className="options-panel"><div className="panel-label"><span>Settings</span><button type="button" className="text-button" onClick={() => resetSettings()}><RefreshCcw size={14}/> Reset</button></div>{showFormat && <Field label="Output format"><select value={format} onChange={(event) => setFormat(event.target.value as ImageFormat)}>{selectableFormats.map((value) => <option key={value} value={value}>{formatLabels[value]}</option>)}</select></Field>}{showQuality && <><Field label="Quality" value={`${quality}%`}><input type="range" min="10" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))}/></Field><p className="option-help">Quality applies to {formatLabels[format]} encoding. The original is never changed.</p></>}{(mode === 'compress' || mode === 'converter') && format === 'image/png' && <p className="option-help">PNG export is lossless, so there is no quality setting.</p>}{mode === 'resize' && <><Field label="Resize mode"><select value={resizeUnit} onChange={(event) => setResizeUnit(event.target.value as ResizeUnit)}><option value="pixels">Pixels</option><option value="percent">Percentage</option></select></Field><label className="check-row"><input type="checkbox" checked={lockAspectRatio} onChange={(event) => setLockAspectRatio(event.target.checked)}/>Lock aspect ratio</label><div className="field-grid">{resizeUnit === 'pixels' ? <><Field label="Width" value="px"><input type="number" min="1" max="16384" value={width} onChange={(event) => updateWidth(Number(event.target.value))}/></Field><Field label="Height" value="px"><input type="number" min="1" max="16384" value={height} onChange={(event) => updateHeight(Number(event.target.value))}/></Field></> : <><Field label="Width" value="%"><input type="number" min="1" max="400" value={widthPercent} onChange={(event) => updateWidthPercent(Number(event.target.value))}/></Field><Field label="Height" value="%"><input type="number" min="1" max="400" value={heightPercent} onChange={(event) => updateHeightPercent(Number(event.target.value))}/></Field></>}</div></>}{mode === 'transform' && <><div className="segmented"><button type="button" className={rotation === -90 ? 'active' : ''} onClick={() => setRotation(-90)}><RotateCcw size={17}/> 90° left</button><button type="button" className={rotation === 90 ? 'active' : ''} onClick={() => setRotation(90)}><RotateCw size={17}/> 90° right</button><button type="button" className={rotation === 180 ? 'active' : ''} onClick={() => setRotation(180)}>180°</button></div><label className="check-row"><input type="checkbox" checked={flipX} onChange={(event) => setFlipX(event.target.checked)}/>Flip horizontally</label><label className="check-row"><input type="checkbox" checked={flipY} onChange={(event) => setFlipY(event.target.checked)}/>Flip vertically</label></>}{mode === 'watermark' && <><Field label="Watermark text"><input value={watermark} maxLength={120} onChange={(event) => setWatermark(event.target.value)}/></Field><Field label="Position"><select value={watermarkPosition} onChange={(event) => setWatermarkPosition(event.target.value as WatermarkPosition)}>{positions.map((value) => <option key={value} value={value}>{value.replace('-', ' ')}</option>)}</select></Field><Field label="Opacity" value={`${watermarkOpacity}%`}><input type="range" min="0" max="100" value={watermarkOpacity} onChange={(event) => setWatermarkOpacity(Number(event.target.value))}/></Field><Field label="Size" value={`${watermarkSize}px`}><input type="range" min="8" max="240" value={watermarkSize} onChange={(event) => setWatermarkSize(Number(event.target.value))}/></Field><Field label="Padding" value={`${watermarkPadding}px`}><input type="range" min="0" max="200" value={watermarkPadding} onChange={(event) => setWatermarkPadding(Number(event.target.value))}/></Field><Field label="Rotation" value={`${watermarkRotation}°`}><input type="range" min="-180" max="180" value={watermarkRotation} onChange={(event) => setWatermarkRotation(Number(event.target.value))}/></Field></>}{mode === 'metadata' && <p className="option-help">Re-encoding removes embedded metadata while keeping the image in its current format.</p>}{format === 'image/jpeg' && <p className="option-help">Transparent areas are filled with white for JPG output.</p>}<button className={`button ${status === 'completed' ? 'success' : 'primary'} action-button`} type="button" disabled={status === 'processing' || (mode === 'watermark' && !watermark.trim())} onClick={run}>{status === 'processing' ? 'Processing...' : status === 'completed' ? 'Process again' : action}</button>{error && <p className="field-error" role="alert">{error}</p>}{result && <a className="button secondary action-button" href={result.url} download={outputFilename(file.name, suffix, extension)}><Download size={17}/> Download {formatLabels[format]}</a>}</div></div>}</section>
}

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return <label className="field"><span>{label}{value && <small>{value}</small>}</span>{children}</label>
}
