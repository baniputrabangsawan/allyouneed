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

type DownloadNote = 'idle' | 'preparing' | 'done'

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
  const [downloadNote, setDownloadNote] = useState<DownloadNote>('idle')

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
  const showBar = (meta && state === 'ready') || (canDownload && (state === 'ready' || broken))

  useEffect(() => {
    if (!autoDownload || restored || state !== 'ready' || !canDownload) {
      setDownloadNote('idle')
      return
    }
    if (!attempted) {
      setDownloadNote('preparing')
      return
    }
    setDownloadNote('done')
    const hide = window.setTimeout(() => setDownloadNote('idle'), 2400)
    return () => window.clearTimeout(hide)
  }, [attempted, autoDownload, canDownload, restored, state])

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
        <div className={`image-result-frames${showCompare ? ' compare' : ' result-only'}`}>
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

      {showBar ? (
        <div className="image-result-bar">
          {meta && state === 'ready' ? <ImageResultSummary meta={meta} {...(typeLabel ? { typeLabel } : {})} /> : <span />}
          {canDownload && (state === 'ready' || broken) ? (
            <button type="button" className="button secondary image-result-download" onClick={downloadAgain}>
              <Download size={17} aria-hidden="true" /> {copy.workspace.downloadAgain}
            </button>
          ) : null}
        </div>
      ) : null}

      {downloadNote === 'preparing' ? (
        <p className="image-result-status" aria-live="polite">{copy.workspace.downloadPreparing}</p>
      ) : null}
      {downloadNote === 'done' ? (
        <p className="image-result-status" aria-live="polite">{copy.workspace.downloadedAutomatically}</p>
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

function ImageResultSummary({ meta, typeLabel }: { meta: ImageResultMeta; typeLabel?: string }) {
  const copy = useT()
  const facts = [
    typeLabel,
    meta.width && meta.height ? `${meta.width}×${meta.height}` : undefined,
    typeof meta.size === 'number' ? formatBytes(meta.size) : undefined,
  ].filter((value): value is string => Boolean(value))

  const change = [
    typeof meta.originalSize === 'number' && typeof meta.size === 'number'
      ? `${formatBytes(meta.originalSize)} → ${formatBytes(meta.size)}`
      : undefined,
    typeof meta.savedPct === 'number' && meta.savedPct > 0 ? copy.workspace.percentSaved(meta.savedPct) : undefined,
    typeof meta.durationMs === 'number' ? formatDuration(meta.durationMs) : undefined,
  ].filter((value): value is string => Boolean(value))

  if (!meta.filename && facts.length === 0 && change.length === 0) return null

  return (
    <div className="image-result-summary">
      {meta.filename ? <strong title={meta.filename}>{meta.filename}</strong> : null}
      {facts.length > 0 ? <p className="image-result-line">{facts.join(' · ')}</p> : null}
      {change.length > 0 ? <p className="image-result-line">{change.join(' · ')}</p> : null}
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms >= 1000) {
    const seconds = ms / 1000
    const text = (seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1)).replace(/\.0$/, '')
    return `${text}s`
  }
  return `${Math.round(ms)} ms`
}
