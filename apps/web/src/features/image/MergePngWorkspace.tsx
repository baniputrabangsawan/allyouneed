import { Check, ChevronDown, ChevronUp, GripVertical, RefreshCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { FileDropzone } from '@/components/file/FileDropzone'
import { ProcessingProgressPanel } from '@/features/workspaces/processing-progress'
import { useT } from '@/i18n'
import { LocaleLink } from '@/i18n/link'
import { formatBytes } from '@/lib/format'
import { ImageResultPreview } from '@/features/image/ImageResultPreview'
import { motion } from '@/lib/motion/config'
import { Flip, gsap, useGSAP } from '@/lib/motion/gsap'
import { prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import type { ImageOptimizeMode } from '@/processing/client/image-optimize'
import { useImageProcessor } from '@/processing/client/use-image-processor'
import {
  assertSafeMergeSize,
  computeMergeLayout,
  defaultMergeOptions,
  MAX_MERGE_FILES,
  MERGE_ERROR,
  MERGE_GRID_COLUMN_CHOICES,
  MERGE_PNG_ACCEPT,
  MIN_MERGE_FILES,
  mergeOutputFilename,
  remainingMergeSlots,
  reorderItems,
  resolveMergeBackground,
  type MergeAlignX,
  type MergeAlignY,
  type MergeBackground,
  type MergeGridColumns,
  type MergeLayout,
  type MergeOptions,
  type MergeSizing,
} from './merge-png-utils'

interface MergeItem {
  id: string
  file: File
  width: number
  height: number
}

interface MergeResult {
  id: string
  blob: Blob
  url: string
  width: number
  height: number
  originalSize: number
  optimizedSize: number
  savedRatio: number
  recommendWebp: boolean
  durationMs: number
}

const PREVIEW_MAX_WIDTH = 560
const PREVIEW_MAX_HEIGHT = 420

export function MergePngWorkspace() {
  const copy = useT()
  const idRef = useRef(0)
  const listRef = useRef<HTMLUListElement>(null)
  const workspaceRef = useRef<HTMLElement>(null)
  const resultUrlRef = useRef('')
  const thumbUrlsRef = useRef(new Map<string, string>())
  const dragIndexRef = useRef<number | null>(null)
  const selectionRef = useRef(0)
  const runningRef = useRef(false)
  const processor = useImageProcessor()
  const [items, setItems] = useState<MergeItem[]>([])
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({})
  const [options, setOptions] = useState<MergeOptions>(defaultMergeOptions)
  const [background, setBackground] = useState<MergeBackground>('transparent')
  const [customColor, setCustomColor] = useState('#808080')
  const [autoOptimize, setAutoOptimize] = useState(false)
  const [optimizeMode, setOptimizeMode] = useState<ImageOptimizeMode>('auto')
  const [result, setResult] = useState<MergeResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'ready' | 'processing' | 'completed' | 'failed'>('idle')
  const [error, setError] = useState('')
  const [filename, setFilename] = useState('merged-images.png')

  const layout = useMemo(
    () => computeMergeLayout(items.map((item) => ({ width: item.width, height: item.height })), options),
    [items, options],
  )
  const fill = resolveMergeBackground(background, customColor)
  const tooLarge = useMemo(() => {
    if (items.length === 0) return false
    try {
      assertSafeMergeSize(layout.width, layout.height)
      return false
    } catch {
      return true
    }
  }, [items.length, layout.height, layout.width])

  useEffect(() => () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    for (const url of thumbUrlsRef.current.values()) URL.revokeObjectURL(url)
  }, [])

  useGSAP(() => {
    if (prefersReducedMotion()) return
    const cards = listRef.current?.querySelectorAll('.merge-file-card')
    if (!cards?.length) return
    gsap.fromTo(cards, { autoAlpha: 0, y: 8 }, {
      autoAlpha: 1, y: 0, duration: motion.duration.fast, stagger: 0.03, ease: motion.ease.enter,
    })
  }, { dependencies: [items.length], scope: listRef })

  useGSAP(() => {
    if (status !== 'completed' || !result || prefersReducedMotion()) return
    const panel = workspaceRef.current?.querySelector('.image-result-preview')
    if (!panel) return
    gsap.fromTo(panel, { autoAlpha: 0, y: 12, scale: 0.98 }, {
      autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: motion.ease.enter,
    })
  }, { dependencies: [status, result?.url], scope: workspaceRef })

  function nextId() {
    idRef.current += 1
    return `png-${idRef.current}`
  }

  function localizeError(code: string) {
    if (code === MERGE_ERROR.needTwo) return copy.mergePng.addAtLeastTwo
    if (code === MERGE_ERROR.tooMany) return copy.mergePng.tooMany
    if (code === MERGE_ERROR.tooLarge) return copy.mergePng.tooLarge
    if (code === MERGE_ERROR.decode) return copy.mergePng.decodeFailed
    if (code === MERGE_ERROR.export) return copy.mergePng.exportFailed
    if (code.includes('unsupported')) return copy.errors.unsupportedFormat
    return copy.errors.processingFailed
  }

  function clearResult() {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = ''
    setResult(null)
  }

  function syncThumbs(nextItems: MergeItem[]) {
    const next = new Map<string, string>()
    for (const item of nextItems) {
      next.set(item.id, thumbUrlsRef.current.get(item.id) ?? URL.createObjectURL(item.file))
    }
    for (const [id, url] of thumbUrlsRef.current) {
      if (!next.has(id)) URL.revokeObjectURL(url)
    }
    thumbUrlsRef.current = next
    setThumbUrls(Object.fromEntries(next))
  }

  function replaceItems(next: MergeItem[]) {
    setItems(next)
    syncThumbs(next)
    clearResult()
    setStatus(next.length > 0 ? 'ready' : 'idle')
  }

  async function decodeSize(file: File) {
    try {
      const bitmap = await createImageBitmap(file)
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return size
    } catch {
      const url = URL.createObjectURL(file)
      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const element = new Image()
          element.onload = () => resolve(element)
          element.onerror = () => reject(new Error(MERGE_ERROR.decode))
          element.src = url
        })
        return { width: image.naturalWidth, height: image.naturalHeight }
      } finally {
        URL.revokeObjectURL(url)
      }
    }
  }

  async function chooseFiles(selected: File[]) {
    selectionRef.current += 1
    const selection = selectionRef.current
    const room = remainingMergeSlots(items.length)
    if (room === 0) {
      setError(copy.mergePng.tooMany)
      return
    }
    const incoming = selected.slice(0, room)
    const overflow = selected.length > room
    const accepted: MergeItem[] = []
    let decodeFailed = false
    for (const file of incoming) {
      try {
        const size = await decodeSize(file)
        if (selection !== selectionRef.current) return
        accepted.push({ id: nextId(), file, width: size.width, height: size.height })
      } catch {
        decodeFailed = true
      }
    }
    if (selection !== selectionRef.current) return
    if (accepted.length > 0) replaceItems([...items, ...accepted])
    if (overflow) setError(copy.mergePng.tooMany)
    else if (decodeFailed) setError(copy.mergePng.decodeFailed)
    else setError('')
  }

  function removeItem(id: string) {
    replaceItems(items.filter((item) => item.id !== id))
    setError('')
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return
    const list = listRef.current
    const state = !prefersReducedMotion() && list ? Flip.getState(list.children) : null
    replaceItems(reorderItems(items, from, to))
    if (state && list) {
      requestAnimationFrame(() => Flip.from(state, {
        duration: motion.duration.fast,
        ease: motion.ease.layout,
        absolute: false,
      }))
    }
  }

  function patchOptions(patch: Partial<MergeOptions>) {
    setOptions((current) => ({ ...current, ...patch }))
    clearResult()
    setStatus(items.length > 0 ? 'ready' : 'idle')
  }

  function resetAll() {
    selectionRef.current += 1
    replaceItems([])
    setOptions(defaultMergeOptions())
    setBackground('transparent')
    setCustomColor('#808080')
    setAutoOptimize(true)
    setOptimizeMode('auto')
    setError('')
    setFilename('merged-images.png')
  }

  async function run() {
    if (items.length < MIN_MERGE_FILES) {
      setError(copy.mergePng.addAtLeastTwo)
      return
    }
    if (tooLarge) {
      setError(copy.mergePng.tooLarge)
      setStatus('failed')
      return
    }
    if (runningRef.current) return
    runningRef.current = true
    const selection = selectionRef.current
    setStatus('processing')
    setError('')
    const startedAt = performance.now()
    try {
      const output = await processor.run({
        op: 'mergePng',
        inputs: items.map((item) => ({ file: item.file, width: item.width, height: item.height })),
        options,
        background: fill,
        optimize: { enabled: autoOptimize, mode: optimizeMode },
      })
      if (selection !== selectionRef.current) return
      clearResult()
      const url = URL.createObjectURL(output.blob)
      resultUrlRef.current = url
      const nextFilename = mergeOutputFilename()
      setFilename(nextFilename)
      setResult({
        id: crypto.randomUUID(),
        blob: output.blob,
        url,
        width: output.width ?? layout.width,
        height: output.height ?? layout.height,
        originalSize: output.originalSize,
        optimizedSize: output.optimizedSize,
        savedRatio: output.savedRatio,
        recommendWebp: output.recommendWebp,
        durationMs: performance.now() - startedAt,
      })
      setStatus('completed')
    } catch (reason) {
      if (selection !== selectionRef.current) return
      const code = reason instanceof Error ? reason.message : MERGE_ERROR.export
      setError(localizeError(code))
      setStatus('failed')
      processor.setStage('failed')
    } finally {
      runningRef.current = false
    }
  }

  function onDragStart(index: number, event: DragEvent<HTMLElement>) {
    dragIndexRef.current = index
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  function onDrop(index: number, event: DragEvent<HTMLElement>) {
    event.preventDefault()
    const from = dragIndexRef.current
    dragIndexRef.current = null
    if (from == null) return
    moveItem(from, index)
  }

  const previewScale = layout.width > 0 && layout.height > 0
    ? Math.min(1, PREVIEW_MAX_WIDTH / layout.width, PREVIEW_MAX_HEIGHT / layout.height)
    : 1
  const canMerge = items.length >= MIN_MERGE_FILES && status !== 'processing' && !tooLarge
  const layoutLabel = options.layout === 'vertical'
    ? copy.mergePng.vertical
    : options.layout === 'horizontal'
      ? copy.mergePng.horizontal
      : copy.mergePng.grid
  const savedPercent = result ? Math.round(result.savedRatio * 100) : 0
  const displayWidth = result?.width ?? layout.width
  const displayHeight = result?.height ?? layout.height

  return (
    <section ref={workspaceRef} className="workspace split-workspace merge-workspace">
      <div className="options-panel">
        <div className="panel-label">
          <span>{copy.mergePng.imagesHeading}</span>
          <button type="button" className="text-button" onClick={resetAll}><RefreshCcw size={14} /> {copy.mergePng.reset}</button>
        </div>
        <FileDropzone
          accept={MERGE_PNG_ACCEPT}
          multiple
          maxFiles={MAX_MERGE_FILES}
          onFilesSelected={(files) => void chooseFiles(files)}
        />
        {items.length > 0 && (
          <ul ref={listRef} className="merge-file-list">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="merge-file-card"
                draggable
                onDragStart={(event) => onDragStart(index, event)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(index, event)}
              >
                {thumbUrls[item.id] ? (
                  <img src={thumbUrls[item.id]} alt="" width={56} height={56} />
                ) : (
                  <span className="merge-thumb-fallback" />
                )}
                <span className="merge-file-meta">
                  <strong>{item.file.name}</strong>
                  <small>{item.width}×{item.height}px · {formatBytes(item.file.size)}</small>
                </span>
                <span className="merge-file-actions">
                  <span className="merge-drag" title={copy.mergePng.dragHandle} aria-hidden="true">
                    <GripVertical size={16} />
                  </span>
                  <button type="button" className="text-button" aria-label={copy.mergePng.moveUp} disabled={index === 0} onClick={() => moveItem(index, index - 1)}>
                    <ChevronUp size={16} />
                  </button>
                  <button type="button" className="text-button" aria-label={copy.mergePng.moveDown} disabled={index === items.length - 1} onClick={() => moveItem(index, index + 1)}>
                    <ChevronDown size={16} />
                  </button>
                  <button type="button" className="text-button" aria-label={`${copy.workspace.remove} ${item.file.name}`} onClick={() => removeItem(item.id)}>
                    <Trash2 size={15} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="panel-label"><span>{copy.mergePng.settings}</span></div>
        <p className="option-help">{copy.mergePng.localNote}</p>
        <div className="field">
          <span>{copy.mergePng.layout}</span>
          <div className="segmented merge-segmented" role="group" aria-label={copy.mergePng.layout}>
            {(['vertical', 'horizontal', 'grid'] as const).map((value) => (
              <button key={value} type="button" className={options.layout === value ? 'active' : ''} aria-pressed={options.layout === value} onClick={() => patchOptions({ layout: value satisfies MergeLayout })}>
                {value === 'vertical' ? copy.mergePng.vertical : value === 'horizontal' ? copy.mergePng.horizontal : copy.mergePng.grid}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{copy.mergePng.sizing}</span>
          <div className="segmented" role="group" aria-label={copy.mergePng.sizing}>
            {([
              ['original', copy.mergePng.original],
              ['fit-uniform', copy.mergePng.fitUniform],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" className={options.sizing === value ? 'active' : ''} aria-pressed={options.sizing === value} onClick={() => patchOptions({ sizing: value satisfies MergeSizing })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {options.layout !== 'horizontal' && (
          <div className="field">
            <span>{copy.mergePng.alignX}</span>
            <div className="segmented" role="group" aria-label={copy.mergePng.alignX}>
              {(['left', 'center', 'right'] as const).map((value) => (
                <button key={value} type="button" className={options.alignX === value ? 'active' : ''} aria-pressed={options.alignX === value} onClick={() => patchOptions({ alignX: value satisfies MergeAlignX })}>
                  {value === 'left' ? copy.mergePng.left : value === 'right' ? copy.mergePng.right : copy.mergePng.center}
                </button>
              ))}
            </div>
          </div>
        )}
        {options.layout !== 'vertical' && (
          <div className="field">
            <span>{copy.mergePng.alignY}</span>
            <div className="segmented" role="group" aria-label={copy.mergePng.alignY}>
              {(['top', 'center', 'bottom'] as const).map((value) => (
                <button key={value} type="button" className={options.alignY === value ? 'active' : ''} aria-pressed={options.alignY === value} onClick={() => patchOptions({ alignY: value satisfies MergeAlignY })}>
                  {value === 'top' ? copy.mergePng.top : value === 'bottom' ? copy.mergePng.bottom : copy.mergePng.center}
                </button>
              ))}
            </div>
          </div>
        )}
        <CompactRange
          label={copy.mergePng.gap}
          value={options.gap}
          max={32}
          onChange={(value) => patchOptions({ gap: value })}
        />
        <CompactRange
          label={copy.mergePng.padding}
          value={options.padding}
          max={32}
          onChange={(value) => patchOptions({ padding: value })}
        />
        <div className="field">
          <span>{copy.mergePng.background}</span>
          <div className="segmented merge-segmented-4" role="group" aria-label={copy.mergePng.background}>
            {(['transparent', 'white', 'black', 'custom'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={background === value ? 'active' : ''}
                aria-pressed={background === value}
                onClick={() => { setBackground(value satisfies MergeBackground); clearResult(); setStatus(items.length > 0 ? 'ready' : 'idle') }}
              >
                {value === 'transparent' ? copy.mergePng.transparent : value === 'white' ? copy.mergePng.white : value === 'black' ? copy.mergePng.black : copy.mergePng.custom}
              </button>
            ))}
          </div>
        </div>
        {background === 'custom' && (
          <Field label={copy.mergePng.customColor}>
            <input aria-label={copy.mergePng.customColor} type="color" value={customColor} onChange={(event) => { setCustomColor(event.target.value); clearResult(); setStatus(items.length > 0 ? 'ready' : 'idle') }} />
          </Field>
        )}
        <label className="check-row">
          <input type="checkbox" checked={autoOptimize} onChange={(event) => { setAutoOptimize(event.target.checked); clearResult(); setStatus(items.length > 0 ? 'ready' : 'idle') }} />
          {copy.workspace.autoOptimize}
        </label>
        <details className="merge-advanced">
          <summary>{copy.mergePng.advanced}</summary>
          {options.layout === 'grid' && (
            <div className="field">
              <span>{copy.mergePng.columns}</span>
              <div className="segmented merge-segmented-4" role="group" aria-label={copy.mergePng.columns}>
                {MERGE_GRID_COLUMN_CHOICES.map((value) => (
                  <button key={String(value)} type="button" className={options.columns === value ? 'active' : ''} aria-pressed={options.columns === value} onClick={() => patchOptions({ columns: value as MergeGridColumns })}>
                    {value === 'auto' ? copy.mergePng.auto : String(value)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Field label={copy.mergePng.sizing}>
            <select aria-label={copy.mergePng.sizing} value={options.sizing} onChange={(event) => patchOptions({ sizing: event.target.value as MergeSizing })}>
              <option value="original">{copy.mergePng.original}</option>
              <option value="fit-uniform">{copy.mergePng.fitUniform}</option>
              <option value="fit-largest-width">{copy.mergePng.fitLargestWidth}</option>
              <option value="fit-largest-height">{copy.mergePng.fitLargestHeight}</option>
              <option value="custom">{copy.mergePng.customCell}</option>
            </select>
          </Field>
          {options.sizing === 'custom' && (
            <div className="field-grid">
              <Field label={copy.mergePng.cellWidth} value="px">
                <input aria-label={copy.mergePng.cellWidth} type="number" min="1" max="16384" value={options.customCell.width} onChange={(event) => patchOptions({ customCell: { ...options.customCell, width: Number(event.target.value) || 1 } })} />
              </Field>
              <Field label={copy.mergePng.cellHeight} value="px">
                <input aria-label={copy.mergePng.cellHeight} type="number" min="1" max="16384" value={options.customCell.height} onChange={(event) => patchOptions({ customCell: { ...options.customCell, height: Number(event.target.value) || 1 } })} />
              </Field>
            </div>
          )}
          {autoOptimize && (
            <div className="field">
              <span>{copy.workspace.autoOptimize}</span>
              <div className="segmented" role="group" aria-label={copy.workspace.autoOptimize}>
                {(['auto', 'lossless', 'strong'] as const).map((value) => (
                  <button key={value} type="button" className={optimizeMode === value ? 'active' : ''} aria-pressed={optimizeMode === value} onClick={() => { setOptimizeMode(value); clearResult(); setStatus(items.length > 0 ? 'ready' : 'idle') }}>
                    {value === 'auto' ? copy.workspace.optimizeAuto : value === 'lossless' ? copy.workspace.optimizeLossless : copy.workspace.optimizeStrong}
                  </button>
                ))}
              </div>
            </div>
          )}
        </details>
        {status === 'processing' && <ProcessingProgressPanel stage={processor.stage} title="Processing image..." percent={processor.percent} />}
        {status === 'failed' && <ProcessingProgressPanel stage="failed" title="Processing failed" detail={error || 'Processing failed'} />}
        <button className={`button ${status === 'completed' ? 'success' : 'primary'} action-button`} type="button" disabled={!canMerge} onClick={() => void run()}>
          {status === 'processing' ? copy.mergePng.processing : status === 'completed' ? copy.mergePng.mergeAgain : status === 'failed' ? 'Try again' : copy.mergePng.merge}
        </button>
        {items.length > 0 && items.length < MIN_MERGE_FILES && <p className="option-help" role="status">{copy.mergePng.addAtLeastTwo}</p>}
        {tooLarge && <p className="field-error" role="alert">{copy.mergePng.tooLarge}</p>}
        {error && status !== 'failed' && <p className="field-error" role="alert">{error}</p>}
      </div>
      <div className="result-card">
        <div className="panel-label"><span>{copy.workspace.preview}</span></div>
        {items.length === 0 ? (
          <p className="option-help">{copy.mergePng.emptyPreview}</p>
        ) : result ? (
          <ImageResultPreview
            resultSrc={result.url}
            compare={false}
            checkerboard={!fill}
            resultAlt={copy.mergePng.resultAlt}
            downloadId={result.id}
            downloadSource={result.blob}
            downloadFilename={filename}
            meta={{ filename, mime: 'image/png', width: result.width, height: result.height, size: result.optimizedSize, originalSize: result.originalSize, savedPct: savedPercent, durationMs: result.durationMs }}
          />
        ) : (
          <div
            className={`merge-preview-stage${fill ? '' : ' merge-checker'}`}
            style={{
              width: Math.max(1, Math.round(layout.width * previewScale)),
              height: Math.max(1, Math.round(layout.height * previewScale)),
              background: fill ?? undefined,
            }}
            role="img"
            aria-label={copy.mergePng.layoutPreview}
          >
            {items.map((item, index) => {
              const placement = layout.placements[index]
              const src = thumbUrls[item.id]
              if (!placement || !src) return null
              return (
                <img
                  key={item.id}
                  src={src}
                  alt=""
                  style={{
                    left: placement.x * previewScale,
                    top: placement.y * previewScale,
                    width: Math.max(1, placement.width * previewScale),
                    height: Math.max(1, placement.height * previewScale),
                  }}
                />
              )
            })}
          </div>
        )}
        {status === 'completed' && result && (
          <p className="merge-success" role="status"><Check size={16} /> {copy.mergePng.merged}</p>
        )}
        {items.length > 0 && (
          <dl className="result-stats">
            <div><dt>{copy.mergePng.images}</dt><dd>{items.length}</dd></div>
            <div><dt>{copy.mergePng.dimensions}</dt><dd>{displayWidth}×{displayHeight}px</dd></div>
            <div><dt>{copy.mergePng.layoutMode}</dt><dd>{layoutLabel}</dd></div>
          </dl>
        )}
        {result?.recommendWebp && (
          <p className="option-help">
            {copy.workspace.recommendWebp}{' '}
            <LocaleLink to="/$tool" params={{ tool: 'png-to-webp' }}>{copy.workspace.convertToWebp}</LocaleLink>
          </p>
        )}

      </div>
    </section>
  )
}

function CompactRange({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="field merge-range">
      <span>{label}<small>{value} px</small></span>
      <input aria-label={label} type="range" min="0" max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return <label className="field"><span>{label}{value && <small>{value}</small>}</span>{children}</label>
}
