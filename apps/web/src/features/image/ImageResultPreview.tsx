import { Download } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useT } from '@/i18n'
import { formatBytes } from '@/lib/format'
import { downloadBlob, triggerDownload } from '@/lib/media/download'
import { useAutoDownloadResult } from '@/lib/media/use-auto-download'
import {
  imagePreviewState,
  mimeLabel,
  shouldAutoDownload,
  shouldCompare,
  usesCheckerboard,
} from './image-result'

export interface ImageResultMeta {
  filename?: string | undefined
  mime?: string | undefined
  width?: number | undefined
  height?: number | undefined
  size?: number | undefined
  originalSize?: number | undefined
  savedPct?: number | undefined
  durationMs?: number | undefined
}

export interface ImageResultPreviewProps {
  originalSrc?: string | undefined
  resultSrc?: string | undefined
  compare?: boolean | undefined
  checkerboard?: boolean | undefined
  resultBackground?: string | undefined
  processing?: boolean | undefined
  failed?: boolean | undefined
  error?: string | undefined
  onRetry?: () => void
  meta?: ImageResultMeta | undefined
  originalAlt?: string | undefined
  resultAlt?: string | undefined
  downloadId?: string | undefined
  downloadSource?: Blob | string | undefined
  downloadFilename?: string | undefined
  autoDownload?: boolean | undefined
  restored?: boolean | undefined
  children?: ReactNode
}

export function ImageResultPreview({
  originalSrc,
  resultSrc,
  compare = true,
  checkerboard,
  resultBackground,
  processing = false,
  failed = false,
  error,
  onRetry,
  meta,
  originalAlt,
  resultAlt,
  downloadId,
  downloadSource,
  downloadFilename,
  autoDownload = true,
  restored = false,
  children,
}: ImageResultPreviewProps) {
  const copy = useT()
  const [view, setView] = useState<'compare' | 'result'>('compare')
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [resultSrc])

  const canCompare = shouldCompare(originalSrc, resultSrc, compare)
  const showCompare = canCompare && view === 'compare'
  const check = usesCheckerboard({
    ...(checkerboard === undefined ? {} : { checkerboard }),
    ...(meta?.mime ? { mime: meta.mime } : {}),
    filename: meta?.filename ?? downloadFilename,
  })
  const state = imagePreviewState({ processing, failed: failed || broken, resultSrc })
  const attempted = useAutoDownloadResult({
    id: downloadId,
    source: downloadSource,
    filename: downloadFilename,
    enabled: autoDownload && state === 'ready',
    restored,
  })
  const canDownload = shouldAutoDownload({
    id: downloadId ?? 'manual',
    source: downloadSource,
    filename: downloadFilename,
    enabled: true,
    restored: false,
  })
  const typeLabel = mimeLabel(meta?.mime, meta?.filename ?? downloadFilename)

  function downloadAgain() {
    if (!downloadSource || !downloadFilename) return
    if (typeof downloadSource === 'string') triggerDownload(downloadSource, downloadFilename)
    else downloadBlob(downloadSource, downloadFilename)
  }

  return (
    <div className="image-result-preview">
      {canCompare && (
        <div className="segmented image-result-toolbar" role="radiogroup" aria-label={copy.workspace.compareView}>
          <button type="button" role="radio" aria-checked={view === 'compare'} className={view === 'compare' ? 'active' : ''} onClick={() => setView('compare')}>
            {copy.workspace.sideBySide}
          </button>
          <button type="button" role="radio" aria-checked={view === 'result'} className={view === 'result' ? 'active' : ''} onClick={() => setView('result')}>
            {copy.workspace.resultOnly}
          </button>
        </div>
      )}

      {state === 'empty' && !originalSrc && (
        <p className="image-result-status">{copy.workspace.emptyImagePreview}</p>
      )}

      {state === 'failed' && !originalSrc && !resultSrc && (
        <div className="image-result-status" role="alert">
          <p>{copy.workspace.imagePreviewUnavailable}</p>
          {error ? <p className="field-error">{error}</p> : null}
          {onRetry ? <button type="button" className="button secondary" onClick={onRetry}>{copy.workspace.tryAgain}</button> : null}
        </div>
      )}

      {(originalSrc || resultSrc || processing) && (
        <div className={`image-result-frames${showCompare ? ' compare' : ''}`}>
          {showCompare && originalSrc ? (
            <PreviewFrame src={originalSrc} title={copy.workspace.original} alt={originalAlt ?? copy.workspace.originalAlt} />
          ) : null}
          {resultSrc ? (
            <PreviewFrame
              src={resultSrc}
              alt={resultAlt ?? copy.workspace.resultAlt}
              checkerboard={check}
              {...(showCompare ? { title: copy.workspace.result } : {})}
              {...(resultBackground ? { background: resultBackground } : {})}
              onError={() => setBroken(true)}
            />
          ) : originalSrc && !showCompare ? (
            <PreviewFrame src={originalSrc} alt={originalAlt ?? copy.workspace.originalAlt} />
          ) : processing ? (
            <figure className="image-result-frame">
              {showCompare ? <figcaption>{copy.workspace.result}</figcaption> : null}
              <div className={`image-result-stage${check ? ' image-checkerboard' : ''}`}>
                <div className="image-result-skeleton" aria-hidden="true" />
                <p className="image-result-status">{copy.workspace.processingPreview}</p>
              </div>
            </figure>
          ) : null}
        </div>
      )}

      {processing && resultSrc == null && originalSrc ? (
        <p className="image-result-status" aria-live="polite">{copy.workspace.processingPreview}</p>
      ) : null}

      {broken && resultSrc ? (
        <p className="image-result-status" role="status">{copy.workspace.imagePreviewUnavailable}</p>
      ) : null}

      {failed && onRetry ? (
        <button type="button" className="button secondary" onClick={onRetry}>{copy.workspace.tryAgain}</button>
      ) : null}


      {attempted ? <p className="option-help" aria-live="polite">{copy.workspace.autoDownloading}</p> : null}
      {meta && state === 'ready' ? <ResultMeta meta={meta} {...(typeLabel ? { typeLabel } : {})} /> : null}
      {canDownload && (state === 'ready' || broken) ? (
        <button type="button" className="button secondary action-button" onClick={downloadAgain}>
          <Download size={17} aria-hidden="true" /> {copy.workspace.downloadAgain}
        </button>
      ) : null}

      {children}
    </div>
  )
}

function PreviewFrame({
  src,
  alt,
  title,
  checkerboard = false,
  background,
  onError,
}: {
  src: string
  alt: string
  title?: string
  checkerboard?: boolean
  background?: string
  onError?: () => void
}) {
  return (
    <figure className="image-result-frame">
      {title ? <figcaption>{title}</figcaption> : null}
      <div
        className={`image-result-stage${checkerboard ? ' image-checkerboard' : ''}`}
        style={background ? { backgroundColor: background, backgroundImage: 'none' } : undefined}
      >
        <img src={src} alt={alt} onError={onError} />
      </div>
    </figure>
  )
}

function ResultMeta({ meta, typeLabel }: { meta: ImageResultMeta; typeLabel?: string }) {
  const copy = useT()
  const items: { label: string; value: string }[] = []
  if (meta.filename) items.push({ label: copy.workspace.filename, value: meta.filename })
  if (typeLabel) items.push({ label: copy.workspace.fileType, value: typeLabel })
  if (meta.width && meta.height) items.push({ label: copy.workspace.dimensions, value: `${meta.width}×${meta.height}px` })
  if (typeof meta.originalSize === 'number' && typeof meta.size === 'number') {
    items.push({ label: copy.workspace.originalSize, value: formatBytes(meta.originalSize) })
    items.push({ label: copy.workspace.resultSize, value: formatBytes(meta.size) })
  } else if (typeof meta.size === 'number') {
    items.push({ label: copy.workspace.fileSize, value: formatBytes(meta.size) })
  }
  if (typeof meta.savedPct === 'number' && meta.savedPct > 0) {
    items.push({ label: copy.workspace.saved, value: `${meta.savedPct}%` })
  }
  if (typeof meta.durationMs === 'number') {
    items.push({ label: copy.workspace.processingTime, value: `${Math.round(meta.durationMs)} ms` })
  }
  if (items.length === 0) return null
  return (
    <dl className="result-stats">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
