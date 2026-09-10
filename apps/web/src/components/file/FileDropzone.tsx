import { CheckCircle2, CircleAlert, Upload } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { validateFiles } from '@/features/image/image-utils'

export type DropzoneStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export interface DropzoneProgress {
  fileName?: string
  percent?: number | null
  label?: string
}

interface FileDropzoneOptions {
  accept?: readonly string[]
  multiple?: boolean
  maxFiles?: number
  maxFileSize?: number
  status?: DropzoneStatus
  progress?: DropzoneProgress
  disabled?: boolean
}

type FileDropzoneProps = FileDropzoneOptions & (
  | { onFilesSelected: (files: File[]) => void; onFileSelected?: (file: File) => void }
  | { onFilesSelected?: never; onFileSelected: (file: File) => void }
)

export function FileDropzone({
  accept = [], multiple = false, maxFiles, maxFileSize = 25 * 1024 * 1024,
  status = 'idle', progress, disabled = false,
  onFilesSelected, onFileSelected,
}: FileDropzoneProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const busy = disabled || status === 'uploading' || status === 'processing'
  const visual = dragging ? 'dragging' : error || status === 'error' ? 'error' : status
  const percent = progress?.percent == null ? null : Math.max(0, Math.min(100, Math.round(progress.percent)))
  const showProgress = status !== 'idle' || Boolean(progress?.fileName)
  const statusLabel = progress?.label
    ?? (status === 'uploading' ? 'Uploading...' : status === 'processing' ? 'Processing...' : status === 'success' ? 'Completed' : status === 'error' ? 'Upload failed' : '')

  function select(fileList: FileList | readonly File[] | null) {
    if (busy) return
    const result = validateFiles(fileList ? Array.from(fileList) : [], {
      accept,
      multiple,
      maxFileSize,
      ...(maxFiles === undefined ? {} : { maxFiles }),
    })
    if (result.error) return setError(result.error)
    if (result.files.length === 0) return
    setError('')
    onFilesSelected?.(result.files)
    if (!onFilesSelected && result.files[0]) onFileSelected?.(result.files[0])
  }

  const selectionLimit = multiple ? maxFiles : 1
  const detail = [
    accept.length > 0 ? accept.map((type) => type.startsWith('.') ? type.slice(1).toUpperCase() : type.split('/')[1]?.toUpperCase() ?? type).join(', ') : 'Any file type',
    `Maximum ${Math.round(maxFileSize / 1024 / 1024)} MB each`,
    selectionLimit ? `Up to ${selectionLimit} file${selectionLimit === 1 ? '' : 's'}` : undefined,
  ].filter(Boolean).join(' · ')
  const Icon = visual === 'success' ? CheckCircle2 : visual === 'error' ? CircleAlert : Upload

  return (
    <div
      className="dropzone-shell"
      tabIndex={0}
      onPaste={(event) => {
        if (busy) return
        const files = Array.from(event.clipboardData.items).filter((item) => item.kind === 'file').map((item) => item.getAsFile()).filter((file): file is File => file !== null)
        if (files.length > 0) { event.preventDefault(); select(files) }
      }}
      onKeyDown={(event) => {
        if (busy || event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
    >
      <label
        htmlFor={id}
        className={['dropzone', visual !== 'idle' ? visual : '', busy ? 'busy' : ''].filter(Boolean).join(' ')}
        aria-disabled={busy}
        onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) select(event.dataTransfer.files) }}
      >
        <Icon size={27} aria-hidden="true" />
        {showProgress && (progress?.fileName || statusLabel) ? (
          <div className="dropzone-progress">
            {progress?.fileName && <strong className="dropzone-filename">{progress.fileName}</strong>}
            <span className="dropzone-status" role="status" aria-live="polite">
              {statusLabel}{status === 'uploading' && percent != null ? ` ${percent}%` : ''}
            </span>
            {(status === 'uploading' || status === 'processing') && (
              <div
                className="dropzone-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                {...(percent == null ? { 'aria-valuetext': statusLabel || 'In progress' } : { 'aria-valuenow': percent })}
              >
                <div className={`dropzone-fill${percent == null ? ' indeterminate' : ''}`} style={percent == null ? undefined : { width: `${percent}%` }} />
              </div>
            )}
          </div>
        ) : (
          <>
            <strong>{dragging ? 'Drop your file here' : `Drop or paste your ${multiple ? 'files' : 'file'} here`}</strong>
            <span>or <u>browse files</u></span>
            <small>{detail}</small>
          </>
        )}
        {error && <p className="dropzone-error" role="alert">{error}</p>}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept.length > 0 ? accept.join(',') : undefined}
          multiple={multiple}
          disabled={busy}
          onChange={(event) => { select(event.target.files); event.target.value = '' }}
        />
      </label>
    </div>
  )
}
