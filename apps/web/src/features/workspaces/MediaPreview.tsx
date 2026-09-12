import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import type { MediaKind } from '../../lib/media/kind'

interface MediaPreviewProps {
  src: string
  kind: MediaKind
  label: string
  title?: string
}

export function MediaPreview({ src, kind, label, title }: MediaPreviewProps) {
  const copy = useT()
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported'>('loading')

  useEffect(() => {
    setStatus('loading')
  }, [src])

  const mediaProps = {
    src,
    controls: true,
    preload: 'metadata' as const,
    onLoadedMetadata: () => setStatus('ready'),
    onCanPlay: () => setStatus('ready'),
    onError: () => setStatus('unsupported'),
  }

  return (
    <div className="media-preview">
      {title && <p className="media-preview-meta">{title}</p>}
      {kind === 'video'
        ? <video {...mediaProps} aria-label={label} />
        : <audio {...mediaProps} aria-label={label} />}
      {status === 'unsupported' && (
        <p className="media-preview-warning" role="status">{copy.errors.previewUnavailable}</p>
      )}
    </div>
  )
}
