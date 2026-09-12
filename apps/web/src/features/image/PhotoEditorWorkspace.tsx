import { Download, FileImage, Redo2, RefreshCcw, RotateCcw, RotateCw, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { FileDropzone } from '@/components/file/FileDropzone'
import {
  clampCrop,
  clampPhotoEditorState,
  createPhotoEditorHistory,
  dragCrop,
  fitDisplaySize,
  identityPhotoEditorState,
  photoEditorExportSpec,
  photoEditorOutputSize,
  pushPhotoEditorHistory,
  redoPhotoEditorHistory,
  resetPhotoEditorHistory,
  undoPhotoEditorHistory,
  type PhotoCropHandle,
  type PhotoEditorFormat,
  type PhotoEditorHistory,
  type PhotoEditorState,
} from '@/features/image/photo-editor-utils'
import { assertValidImageSize, type ImageCrop, type Size } from '@/features/image/image-utils'
import { formatBytes, outputFilename } from '@/lib/format'
import { motion } from '@/lib/motion/config'
import { gsap, useGSAP } from '@/lib/motion/gsap'
import { prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { canvasToBlob, drawProcessedImage } from '@/processing/client/image'

interface ExportResult {
  blob: Blob
  url: string
  width: number
  height: number
  mime: PhotoEditorFormat
  durationMs: number
}

interface CropDrag {
  handle: PhotoCropHandle
  origin: ImageCrop
  start: { x: number; y: number }
}

const accept = ['image/jpeg', 'image/png', 'image/webp'] as const
const formats: readonly PhotoEditorFormat[] = ['image/jpeg', 'image/png', 'image/webp']
const formatLabels: Readonly<Record<PhotoEditorFormat, string>> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
}
const cropHandles: PhotoCropHandle[] = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']
const previewBounds = { width: 720, height: 420 }

export function PhotoEditorWorkspace() {
  const bitmapRef = useRef<ImageBitmap | null>(null)
  const resultUrlRef = useRef('')
  const selectionRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cropLayerRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<HTMLElement>(null)
  const dragRef = useRef<CropDrag | null>(null)
  const liveRef = useRef<PhotoEditorState | null>(null)
  const stopDragRef = useRef<(() => void) | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState<Size>({ width: 0, height: 0 })
  const [history, setHistory] = useState<PhotoEditorHistory>(() => createPhotoEditorHistory(identityPhotoEditorState({ width: 1, height: 1 })))
  const [live, setLive] = useState<PhotoEditorState | null>(null)
  const [cropMode, setCropMode] = useState(false)
  const [format, setFormat] = useState<PhotoEditorFormat>('image/jpeg')
  const [quality, setQuality] = useState(90)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'ready' | 'processing' | 'completed' | 'failed'>('idle')
  const [error, setError] = useState('')
  const [previewSize, setPreviewSize] = useState<Size>({ width: 0, height: 0 })
  const present = live ?? history.present
  liveRef.current = live
  const output = useMemo(
    () => source.width > 0 ? photoEditorOutputSize(present, source) : { width: 0, height: 0 },
    [present, source],
  )

  useEffect(() => () => {
    stopDragRef.current?.()
    bitmapRef.current?.close()
    bitmapRef.current = null
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
  }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const bitmap = bitmapRef.current
    if (!canvas || !bitmap || source.width < 1) return
    const bounds = { width: Math.max(1, previewBounds.width), height: previewBounds.height }
    if (cropMode) {
      const display = fitDisplaySize(source, bounds)
      const scale = display.width / source.width
      drawProcessedImage(bitmap, {
        crop: { x: 0, y: 0, width: bitmap.width, height: bitmap.height },
        brightness: present.brightness,
        contrast: present.contrast,
        saturation: present.saturation,
        grayscale: present.grayscale,
        blur: present.blur * scale,
        width: display.width,
        height: display.height,
      }, canvas)
      setPreviewSize((current) => current.width === display.width && current.height === display.height ? current : display)
      return
    }
    const display = fitDisplaySize(output, bounds)
    const scale = display.width / Math.max(1, output.width)
    drawProcessedImage(bitmap, {
      crop: present.crop,
      rotation: present.rotation,
      flipX: present.flipX,
      flipY: present.flipY,
      brightness: present.brightness,
      contrast: present.contrast,
      saturation: present.saturation,
      grayscale: present.grayscale,
      blur: present.blur * scale,
      width: Math.max(1, Math.round(present.crop.width * scale)),
      height: Math.max(1, Math.round(present.crop.height * scale)),
    }, canvas)
    setPreviewSize((current) => current.width === display.width && current.height === display.height ? current : display)
  }, [cropMode, output, present, source])

  useGSAP(() => {
    if (status !== 'completed' || prefersReducedMotion()) return
    const panel = workspaceRef.current?.querySelector('.preview-panel')
    if (!panel || !result) return
    gsap.fromTo(panel, { autoAlpha: 0, y: 20, scale: 0.98, filter: 'blur(8px)' }, {
      autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.45, ease: motion.ease.enter, clearProps: 'filter',
    })
  }, { dependencies: [status, result?.url], scope: workspaceRef })

  function clearResult() {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = ''
    setResult(null)
  }

  function commit(next: PhotoEditorState) {
    if (source.width < 1) return
    const clamped = clampPhotoEditorState(next, source)
    setHistory((current) => pushPhotoEditorHistory(current, clamped))
    setLive(null)
    setStatus('ready')
    setError('')
    clearResult()
  }

  function resetEditor() {
    if (source.width < 1) return
    setHistory(resetPhotoEditorHistory(source))
    setLive(null)
    setCropMode(false)
    setFormat(sourceFormat(file))
    setQuality(90)
    setStatus(file ? 'ready' : 'idle')
    setError('')
    clearResult()
  }

  function removeFile() {
    selectionRef.current += 1
    bitmapRef.current?.close()
    bitmapRef.current = null
    setFile(null)
    setSource({ width: 0, height: 0 })
    setHistory(createPhotoEditorHistory(identityPhotoEditorState({ width: 1, height: 1 })))
    setLive(null)
    setCropMode(false)
    setStatus('idle')
    setError('')
    clearResult()
  }

  async function chooseFile(next: File) {
    selectionRef.current += 1
    const selection = selectionRef.current
    try {
      const bitmap = await createImageBitmap(next)
      try {
        assertValidImageSize(bitmap.width, bitmap.height)
      } catch (reason) {
        bitmap.close()
        throw reason
      }
      if (selection !== selectionRef.current) {
        bitmap.close()
        return
      }
      bitmapRef.current?.close()
      bitmapRef.current = bitmap
      const nextSource = { width: bitmap.width, height: bitmap.height }
      setFile(next)
      setSource(nextSource)
      setHistory(createPhotoEditorHistory(identityPhotoEditorState(nextSource)))
      setLive(null)
      setCropMode(false)
      setFormat(sourceFormat(next))
      setQuality(90)
      setStatus('ready')
      setError('')
      clearResult()
    } catch (reason) {
      if (selection !== selectionRef.current) return
      setStatus('failed')
      setError(reason instanceof Error ? reason.message : 'This image could not be read.')
    }
  }

  function undo() {
    setHistory((current) => undoPhotoEditorHistory(current))
    setLive(null)
    clearResult()
    setStatus('ready')
  }

  function redo() {
    setHistory((current) => redoPhotoEditorHistory(current))
    setLive(null)
    clearResult()
    setStatus('ready')
  }

  function pointerOnSource(event: { clientX: number; clientY: number }) {
    const bounds = cropLayerRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width < 1 || bounds.height < 1) return { x: 0, y: 0 }
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * source.width,
      y: ((event.clientY - bounds.top) / bounds.height) * source.height,
    }
  }

  function startCropDrag(event: ReactPointerEvent<HTMLElement>, handle: PhotoCropHandle) {
    if (!cropMode || source.width < 1) return
    event.preventDefault()
    event.stopPropagation()
    stopDragRef.current?.()
    const pointerId = event.pointerId
    dragRef.current = { handle, origin: present.crop, start: pointerOnSource(event) }
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointerId || !dragRef.current) return
      const point = pointerOnSource(next)
      const drag = dragRef.current
      setLive((current) => ({
        ...(current ?? history.present),
        crop: dragCrop(drag.origin, drag.handle, { x: point.x - drag.start.x, y: point.y - drag.start.y }, source),
      }))
    }
    const stop = (next?: PointerEvent) => {
      if (next && next.pointerId !== pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      stopDragRef.current = null
      if (!dragRef.current) return
      dragRef.current = null
      const committed = liveRef.current
      if (committed) commit(committed)
    }
    stopDragRef.current = () => stop()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  async function exportImage() {
    const bitmap = bitmapRef.current
    if (!file || !bitmap || source.width < 1) return
    const selection = selectionRef.current
    setStatus('processing')
    setError('')
    const startedAt = performance.now()
    try {
      const spec = photoEditorExportSpec(present, source, format, quality)
      const canvas = drawProcessedImage(bitmap, {
        crop: present.crop,
        rotation: present.rotation,
        flipX: present.flipX,
        flipY: present.flipY,
        brightness: present.brightness,
        contrast: present.contrast,
        saturation: present.saturation,
        grayscale: present.grayscale,
        blur: present.blur,
        ...(format === 'image/jpeg' ? { backgroundColor: '#fff' } : {}),
      })
      const blob = await canvasToBlob(canvas, spec.mime, spec.quality ?? 1)
      if (selection !== selectionRef.current) return
      clearResult()
      const url = URL.createObjectURL(blob)
      resultUrlRef.current = url
      setResult({ blob, url, width: spec.width, height: spec.height, mime: spec.mime, durationMs: performance.now() - startedAt })
      setStatus('completed')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image export failed.')
      setStatus('failed')
    }
  }

  const extension = format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp'
  const cropStyle = source.width > 0 && source.height > 0 ? {
    left: `${(present.crop.x / source.width) * 100}%`,
    top: `${(present.crop.y / source.height) * 100}%`,
    width: `${(present.crop.width / source.width) * 100}%`,
    height: `${(present.crop.height / source.height) * 100}%`,
  } : undefined

  return (
    <section ref={workspaceRef} className="workspace">
      {!file ? (
        <FileDropzone accept={accept} onFileSelected={(next) => void chooseFile(next)}/>
      ) : (
        <div className="image-workspace">
          <div className="preview-panel">
            <div className="panel-label">
              <span>Preview</span>
              <button type="button" className="text-button" onClick={removeFile}><Trash2 size={15}/> Remove</button>
            </div>
            <div className="image-stage photo-stage">
              <div className="photo-frame">
                <canvas ref={canvasRef} role="img" aria-label={cropMode ? 'Crop source' : 'Edited preview'}/>
                {cropMode && previewSize.width > 0 && (
                  <div ref={cropLayerRef} className="crop-layer">
                    <div className="crop-rect" style={cropStyle} onPointerDown={(event) => startCropDrag(event, 'move')}>
                      {cropHandles.map((handle) => (
                        <button
                          key={handle}
                          type="button"
                          aria-label={`${handle} crop handle`}
                          className={`crop-handle crop-handle-${handle}`}
                          onPointerDown={(event) => startCropDrag(event, handle)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="file-summary">
              <FileImage size={20}/>
              <span>
                <strong>{file.name}</strong>
                <small>
                  {formatBytes(file.size)} · {source.width}×{source.height}px → {output.width}×{output.height}px
                  {result ? ` · ${formatBytes(result.blob.size)} · ${result.width}×${result.height}px · ${Math.round(result.durationMs)} ms` : ''}
                </small>
              </span>
            </div>
          </div>
          <div className="options-panel">
            <div className="panel-label">
              <span>Settings</span>
              <div className="photo-history">
                <button type="button" className="text-button" disabled={history.past.length === 0} onClick={undo}><Undo2 size={14}/> Undo</button>
                <button type="button" className="text-button" disabled={history.future.length === 0} onClick={redo}><Redo2 size={14}/> Redo</button>
                <button type="button" className="text-button" onClick={resetEditor}><RefreshCcw size={14}/> Reset</button>
              </div>
            </div>
            <p className="option-help">Edits stay in this browser. The original file is never overwritten.</p>
            <label className="check-row">
              <input type="checkbox" checked={cropMode} onChange={(event) => setCropMode(event.target.checked)}/>
              Crop mode
            </label>
            {cropMode && (
              <>
                <p className="option-help">Crop uses pixel coordinates from the top-left of the original image. Drag the rectangle or use the fields.</p>
                <div className="field-grid">
                  <Field label="Left" value="px">
                    <input aria-label="Crop left" type="number" min="0" max={Math.max(0, source.width - 1)} value={present.crop.x} onChange={(event) => commit({ ...present, crop: clampCrop({ ...present.crop, x: Number(event.target.value) }, source) })}/>
                  </Field>
                  <Field label="Top" value="px">
                    <input aria-label="Crop top" type="number" min="0" max={Math.max(0, source.height - 1)} value={present.crop.y} onChange={(event) => commit({ ...present, crop: clampCrop({ ...present.crop, y: Number(event.target.value) }, source) })}/>
                  </Field>
                  <Field label="Width" value="px">
                    <input aria-label="Crop width" type="number" min="1" max={source.width} value={present.crop.width} onChange={(event) => commit({ ...present, crop: clampCrop({ ...present.crop, width: Number(event.target.value) }, source) })}/>
                  </Field>
                  <Field label="Height" value="px">
                    <input aria-label="Crop height" type="number" min="1" max={source.height} value={present.crop.height} onChange={(event) => commit({ ...present, crop: clampCrop({ ...present.crop, height: Number(event.target.value) }, source) })}/>
                  </Field>
                </div>
              </>
            )}
            <div className="segmented">
              <button type="button" className={present.rotation === 270 ? 'active' : ''} onClick={() => commit({ ...present, rotation: 270 })}><RotateCcw size={17}/> 90° left</button>
              <button type="button" className={present.rotation === 90 ? 'active' : ''} onClick={() => commit({ ...present, rotation: 90 })}><RotateCw size={17}/> 90° right</button>
              <button type="button" className={present.rotation === 180 ? 'active' : ''} onClick={() => commit({ ...present, rotation: 180 })}>180°</button>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={present.flipX} onChange={(event) => commit({ ...present, flipX: event.target.checked })}/>
              Flip horizontally
            </label>
            <label className="check-row">
              <input type="checkbox" checked={present.flipY} onChange={(event) => commit({ ...present, flipY: event.target.checked })}/>
              Flip vertically
            </label>
            <FilterSlider label="Brightness" value={present.brightness} suffix="%" min={0} max={200} onLive={(value) => setLive(clampPhotoEditorState({ ...present, brightness: value }, source))} onCommit={(value) => commit({ ...present, brightness: value })}/>
            <FilterSlider label="Contrast" value={present.contrast} suffix="%" min={0} max={200} onLive={(value) => setLive(clampPhotoEditorState({ ...present, contrast: value }, source))} onCommit={(value) => commit({ ...present, contrast: value })}/>
            <FilterSlider label="Saturation" value={present.saturation} suffix="%" min={0} max={200} onLive={(value) => setLive(clampPhotoEditorState({ ...present, saturation: value }, source))} onCommit={(value) => commit({ ...present, saturation: value })}/>
            <FilterSlider label="Grayscale" value={present.grayscale} suffix="%" min={0} max={100} onLive={(value) => setLive(clampPhotoEditorState({ ...present, grayscale: value }, source))} onCommit={(value) => commit({ ...present, grayscale: value })}/>
            <FilterSlider label="Blur" value={present.blur} suffix="px" min={0} max={50} onLive={(value) => setLive(clampPhotoEditorState({ ...present, blur: value }, source))} onCommit={(value) => commit({ ...present, blur: value })}/>
            <Field label="Output format">
              <select aria-label="Output format" value={format} onChange={(event) => { setFormat(event.target.value as PhotoEditorFormat); clearResult(); setStatus('ready') }}>
                {formats.map((value) => <option key={value} value={value}>{formatLabels[value]}</option>)}
              </select>
            </Field>
            {format !== 'image/png' ? (
              <Field label="Quality" value={`${quality}%`}>
                <input aria-label="Export quality" type="range" min="10" max="100" value={quality} onChange={(event) => { setQuality(Number(event.target.value)); clearResult(); setStatus('ready') }}/>
              </Field>
            ) : (
              <p className="option-help">PNG export is lossless, so there is no quality setting.</p>
            )}
            {format === 'image/jpeg' && <p className="option-help">Transparent areas are filled with white for JPG output.</p>}
            <button className={`button ${status === 'completed' ? 'success' : 'primary'} action-button`} type="button" disabled={status === 'processing'} onClick={() => void exportImage()}>
              {status === 'processing' ? 'Exporting...' : status === 'completed' ? 'Export again' : 'Export image'}
            </button>
            {error && <p className="field-error" role="alert">{error}</p>}
            {result && (
              <a className="button secondary action-button" href={result.url} download={outputFilename(file.name, 'edited', extension)}>
                <Download size={17}/> Download {formatLabels[result.mime]}
              </a>
            )}
          </div>
        </div>
      )}
      {error && !file && <p className="field-error" role="alert">{error}</p>}
    </section>
  )
}

function FilterSlider({
  label, value, suffix, min, max, onLive, onCommit,
}: {
  label: string
  value: number
  suffix: string
  min: number
  max: number
  onLive: (value: number) => void
  onCommit: (value: number) => void
}) {
  return (
    <Field label={label} value={`${value}${suffix}`}>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onLive(Number(event.target.value))}
        onPointerUp={(event) => onCommit(Number((event.target as HTMLInputElement).value))}
        onKeyUp={(event) => onCommit(Number((event.target as HTMLInputElement).value))}
        onBlur={(event) => onCommit(Number(event.currentTarget.value))}
      />
    </Field>
  )
}

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return <label className="field"><span>{label}{value && <small>{value}</small>}</span>{children}</label>
}

function sourceFormat(file: File | null): PhotoEditorFormat {
  if (file && formats.includes(file.type as PhotoEditorFormat)) return file.type as PhotoEditorFormat
  return 'image/jpeg'
}
