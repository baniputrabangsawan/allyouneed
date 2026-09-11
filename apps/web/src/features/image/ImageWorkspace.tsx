import { Download, FileImage, RefreshCcw, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FileDropzone } from '@/components/file/FileDropzone'
import { FAVICON_ACCEPT, FAVICON_PNG_MIME, type FaviconFit } from '@/features/image/favicon-utils'
import { getImageWorkspaceMode, type ImageWorkspaceMode } from '@/features/image/image-utils'
import { MemeWorkspace } from '@/features/image/MemeWorkspace'
import { PhotoEditorWorkspace } from '@/features/image/PhotoEditorWorkspace'
import { SvgToPngWorkspace } from '@/features/image/SvgToPngWorkspace'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import { CopyButton } from '@/features/workspaces/workspace-ui'
import { formatBytes, outputFilename } from '@/lib/format'
import { motion } from '@/lib/motion/config'
import { gsap, useGSAP } from '@/lib/motion/gsap'
import { prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { decodeSourceImage, generateFaviconPack } from '@/processing/client/favicon'
import { processImage, type ImageCrop, type ImageFormat, type WatermarkPosition } from '@/processing/client/image'

type ResizeUnit = 'pixels' | 'percent'

interface ImageResult {
  blob: Blob
  url: string
  durationMs: number
}

interface FaviconResult {
  files: { filename: string; url: string; mime: string; blob: Blob; width?: number; height?: number }[]
  zipUrl: string
  zipName: string
  html: string
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

function getMode(slug: string): ImageWorkspaceMode {
  return getImageWorkspaceMode(slug) ?? 'converter'
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
  if (tool.slug === 'favicon-generator') return FAVICON_ACCEPT
  if (tool.slug.startsWith('jpg-to-') || tool.slug === 'convert-from-jpg') return ['image/jpeg']
  if (tool.slug.startsWith('png-to-')) return ['image/png']
  if (tool.slug.startsWith('webp-to-')) return ['image/webp']
  return tool.acceptedFormats ?? defaultAccept
}

export function ImageWorkspace({ tool }: { tool: ToolDefinition }) {
  if (tool.slug === 'svg-to-png') return <SvgToPngWorkspace tool={tool}/>
  if (tool.slug === 'meme-generator') return <MemeWorkspace tool={tool}/>
  if (tool.slug === 'photo-editor') return <PhotoEditorWorkspace tool={tool}/>
  return <RasterImageWorkspace tool={tool}/>
}

function RasterImageWorkspace({ tool }: { tool: ToolDefinition }) {
  const mode = getMode(tool.slug)
  const sourceUrlRef = useRef('')
  const resultUrlRef = useRef('')
  const packUrlsRef = useRef<string[]>([])
  const workspaceRef = useRef<HTMLElement>(null)
  const selectionRef = useRef(0)
  const [file, setFile] = useState<File | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [result, setResult] = useState<ImageResult | null>(null)
  const [pack, setPack] = useState<FaviconResult | null>(null)
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
  const [cropX, setCropX] = useState(0)
  const [cropY, setCropY] = useState(0)
  const [cropWidth, setCropWidth] = useState(0)
  const [cropHeight, setCropHeight] = useState(0)
  const [fit, setFit] = useState<FaviconFit>('cover')
  const [watermark, setWatermark] = useState('Kits')
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottom-right')
  const [watermarkOpacity, setWatermarkOpacity] = useState(75)
  const [watermarkSize, setWatermarkSize] = useState(48)
  const [watermarkPadding, setWatermarkPadding] = useState(24)
  const [watermarkRotation, setWatermarkRotation] = useState(0)

  useEffect(() => () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    for (const url of packUrlsRef.current) URL.revokeObjectURL(url)
  }, [])

  function clearResult() {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = ''
    setResult(null)
    for (const url of packUrlsRef.current) URL.revokeObjectURL(url)
    packUrlsRef.current = []
    setPack(null)
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
    setCropX(0)
    setCropY(0)
    setCropWidth(naturalWidth)
    setCropHeight(naturalHeight)
    setFit('cover')
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
      const bitmap = mode === 'favicon' ? await decodeSourceImage(next) : await createImageBitmap(next)
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
      setCropX(0)
      setCropY(0)
      setCropWidth(nextWidth)
      setCropHeight(nextHeight)
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
      if (mode === 'favicon') {
        const generated = await generateFaviconPack(file, { fit })
        if (selection !== selectionRef.current) return
        clearResult()
        const urls: string[] = []
        const files = generated.files.map((entry) => {
          const url = URL.createObjectURL(entry.blob)
          urls.push(url)
          return { ...entry, url }
        })
        const zipUrl = URL.createObjectURL(generated.zip)
        urls.push(zipUrl)
        packUrlsRef.current = urls
        setPack({
          files,
          zipUrl,
          zipName: outputFilename(file.name, 'favicon-pack', 'zip'),
          html: generated.html,
          durationMs: performance.now() - startedAt,
        })
        setStatus('completed')
        return
      }
      const outputWidth = resizeUnit === 'percent' ? Math.max(1, Math.round(naturalWidth * widthPercent / 100)) : width
      const outputHeight = resizeUnit === 'percent' ? Math.max(1, Math.round(naturalHeight * heightPercent / 100)) : height
      const crop: ImageCrop | undefined = mode === 'crop' && naturalWidth > 0
        ? { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
        : undefined
      const blob = await processImage(file, {
        format,
        quality: quality / 100,
        ...(format === 'image/jpeg' ? { backgroundColor: '#fff' } : {}),
        ...(mode === 'resize' ? { width: outputWidth, height: outputHeight } : {}),
        ...(crop ? { crop } : {}),
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
  const action = mode === 'compress' ? 'Compress image' : mode === 'resize' ? 'Resize image' : mode === 'crop' ? 'Crop image' : mode === 'transform' ? 'Apply transform' : mode === 'converter' ? 'Convert image' : mode === 'watermark' ? 'Add watermark' : mode === 'favicon' ? 'Generate favicon pack' : 'Remove metadata'
  const suffix = mode === 'compress' ? 'compressed' : mode === 'resize' ? 'resized' : mode === 'crop' ? 'cropped' : mode === 'transform' ? (tool.slug === 'flip-image' ? 'flipped' : 'rotated') : mode === 'watermark' ? 'watermarked' : mode === 'metadata' ? 'clean' : 'converted'
  const extension = format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp'
  const savings = result && file && file.size > 0 ? Math.round((1 - result.blob.size / file.size) * 100) : null
  const previewUrl = pack?.files.find((entry) => entry.mime === FAVICON_PNG_MIME && entry.width === 180)?.url
    ?? pack?.files.find((entry) => entry.mime === FAVICON_PNG_MIME)?.url
    ?? result?.url
    ?? sourceUrl

  useGSAP(() => {
    if (status !== 'completed' || prefersReducedMotion()) return
    const panel = workspaceRef.current?.querySelector('.preview-panel')
    if (!panel || (!result && !pack)) return
    gsap.fromTo(panel, { autoAlpha: 0, y: 20, scale: 0.98, filter: 'blur(8px)' }, {
      autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.45, ease: motion.ease.enter, clearProps: 'filter',
    })
  }, { dependencies: [status, result?.url, pack?.zipUrl], scope: workspaceRef })

  return <section ref={workspaceRef} className="workspace">{!file ? <FileDropzone accept={inputFormats(tool)} onFileSelected={chooseFile}/> : <div className="image-workspace"><div className="preview-panel"><div className="panel-label"><span>Preview</span><button type="button" className="text-button" onClick={removeFile}><Trash2 size={15}/> Remove</button></div><div className="image-stage"><img src={previewUrl} alt={pack || result ? 'Processed result' : 'Selected input'}/></div><div className="file-summary"><FileImage size={20}/><span><strong>{file.name}</strong><small>{formatBytes(file.size)}{result ? ` -> ${formatBytes(result.blob.size)} · ${savings !== null && savings >= 0 ? `${savings}% saved` : `${Math.abs(savings ?? 0)}% larger`} · ${Math.round(result.durationMs)} ms` : pack ? ` -> ${pack.files.length} files · ${Math.round(pack.durationMs)} ms` : ''}</small></span></div></div><div className="options-panel"><div className="panel-label"><span>Settings</span><button type="button" className="text-button" onClick={() => resetSettings()}><RefreshCcw size={14}/> Reset</button></div>{showFormat && <Field label="Output format"><select value={format} onChange={(event) => setFormat(event.target.value as ImageFormat)}>{selectableFormats.map((value) => <option key={value} value={value}>{formatLabels[value]}</option>)}</select></Field>}{showQuality && <><Field label="Quality" value={`${quality}%`}><input type="range" min="10" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))}/></Field><p className="option-help">Quality applies to {formatLabels[format]} encoding. The original is never changed.</p></>}{(mode === 'compress' || mode === 'converter') && format === 'image/png' && <p className="option-help">PNG export is lossless, so there is no quality setting.</p>}{mode === 'resize' && <><Field label="Resize mode"><select value={resizeUnit} onChange={(event) => setResizeUnit(event.target.value as ResizeUnit)}><option value="pixels">Pixels</option><option value="percent">Percentage</option></select></Field><label className="check-row"><input type="checkbox" checked={lockAspectRatio} onChange={(event) => setLockAspectRatio(event.target.checked)}/>Lock aspect ratio</label><div className="field-grid">{resizeUnit === 'pixels' ? <><Field label="Width" value="px"><input type="number" min="1" max="16384" value={width} onChange={(event) => updateWidth(Number(event.target.value))}/></Field><Field label="Height" value="px"><input type="number" min="1" max="16384" value={height} onChange={(event) => updateHeight(Number(event.target.value))}/></Field></> : <><Field label="Width" value="%"><input type="number" min="1" max="400" value={widthPercent} onChange={(event) => updateWidthPercent(Number(event.target.value))}/></Field><Field label="Height" value="%"><input type="number" min="1" max="400" value={heightPercent} onChange={(event) => updateHeightPercent(Number(event.target.value))}/></Field></>}</div></>}{mode === 'crop' && <><p className="option-help">Crop uses pixel coordinates from the top-left of the original image.</p><div className="field-grid"><Field label="Left" value="px"><input aria-label="Crop left" type="number" min="0" max={Math.max(0, naturalWidth - 1)} value={cropX} onChange={(event) => setCropX(Number(event.target.value))}/></Field><Field label="Top" value="px"><input aria-label="Crop top" type="number" min="0" max={Math.max(0, naturalHeight - 1)} value={cropY} onChange={(event) => setCropY(Number(event.target.value))}/></Field><Field label="Width" value="px"><input aria-label="Crop width" type="number" min="1" max={naturalWidth} value={cropWidth} onChange={(event) => setCropWidth(Number(event.target.value))}/></Field><Field label="Height" value="px"><input aria-label="Crop height" type="number" min="1" max={naturalHeight} value={cropHeight} onChange={(event) => setCropHeight(Number(event.target.value))}/></Field></div></>}{mode === 'transform' && <><div className="segmented"><button type="button" className={rotation === -90 ? 'active' : ''} onClick={() => setRotation(-90)}><RotateCcw size={17}/> 90° left</button><button type="button" className={rotation === 90 ? 'active' : ''} onClick={() => setRotation(90)}><RotateCw size={17}/> 90° right</button><button type="button" className={rotation === 180 ? 'active' : ''} onClick={() => setRotation(180)}>180°</button></div><label className="check-row"><input type="checkbox" checked={flipX} onChange={(event) => setFlipX(event.target.checked)}/>Flip horizontally</label><label className="check-row"><input type="checkbox" checked={flipY} onChange={(event) => setFlipY(event.target.checked)}/>Flip vertically</label></>}{mode === 'watermark' && <><Field label="Watermark text"><input value={watermark} maxLength={120} onChange={(event) => setWatermark(event.target.value)}/></Field><Field label="Position"><select value={watermarkPosition} onChange={(event) => setWatermarkPosition(event.target.value as WatermarkPosition)}>{positions.map((value) => <option key={value} value={value}>{value.replace('-', ' ')}</option>)}</select></Field><Field label="Opacity" value={`${watermarkOpacity}%`}><input type="range" min="0" max="100" value={watermarkOpacity} onChange={(event) => setWatermarkOpacity(Number(event.target.value))}/></Field><Field label="Size" value={`${watermarkSize}px`}><input type="range" min="8" max="240" value={watermarkSize} onChange={(event) => setWatermarkSize(Number(event.target.value))}/></Field><Field label="Padding" value={`${watermarkPadding}px`}><input type="range" min="0" max="200" value={watermarkPadding} onChange={(event) => setWatermarkPadding(Number(event.target.value))}/></Field><Field label="Rotation" value={`${watermarkRotation}°`}><input type="range" min="-180" max="180" value={watermarkRotation} onChange={(event) => setWatermarkRotation(Number(event.target.value))}/></Field></>}{mode === 'metadata' && <p className="option-help">Re-encoding removes embedded metadata while keeping the image in its current format.</p>}{mode === 'favicon' && <><Field label="Crop behavior"><select aria-label="Crop behavior" value={fit} onChange={(event) => setFit(event.target.value as FaviconFit)}><option value="cover">Cover</option><option value="contain">Contain</option></select></Field><p className="option-help">{fit === 'cover' ? 'Cover fills each square and may crop the edges. Transparent pixels stay transparent.' : 'Contain fits the whole image inside each square. Unused space stays transparent.'}</p></>}{format === 'image/jpeg' && mode !== 'favicon' && <p className="option-help">Transparent areas are filled with white for JPG output.</p>}<button className={`button ${status === 'completed' ? 'success' : 'primary'} action-button`} type="button" disabled={status === 'processing' || (mode === 'watermark' && !watermark.trim())} onClick={run}>{status === 'processing' ? 'Processing...' : status === 'completed' ? 'Process again' : action}</button>{error && <p className="field-error" role="alert">{error}</p>}{result && <a className="button secondary action-button" href={result.url} download={outputFilename(file.name, suffix, extension)}><Download size={17}/> Download {formatLabels[format]}</a>}{pack && <><a className="button secondary action-button" href={pack.zipUrl} download={pack.zipName}><Download size={17}/> Download ZIP pack</a><p className="option-help">The pack includes PNG sizes plus favicon.ico. Transparency is preserved.</p><div className="favicon-downloads">{pack.files.map((entry) => <a key={entry.filename} className="button ghost" href={entry.url} download={entry.filename}>{entry.filename}</a>)}</div><label className="field"><span>HTML snippet</span><textarea aria-label="HTML snippet" readOnly rows={7} value={pack.html}/></label><div className="button-row favicon-copy"><CopyButton value={pack.html}/></div></>}</div></div>}</section>
}

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return <label className="field"><span>{label}{value && <small>{value}</small>}</span>{children}</label>
}
