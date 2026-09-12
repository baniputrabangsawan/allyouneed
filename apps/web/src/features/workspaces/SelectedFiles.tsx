import { CheckCircle2 } from 'lucide-react'
import { useRef } from 'react'
import { validateFiles } from '@/features/image/image-utils'
import { useT } from '@/i18n'
import { formatAcceptLabel } from '@/lib/media/accept-labels'
import { fileExtension } from '@/lib/media/mime'
import { formatBytes } from './workspace-utils'

interface SelectedFilesProps {
  files: readonly File[]
  accept?: readonly string[]
  multiple?: boolean
  maxFiles?: number
  maxFileSize?: number
  disabled?: boolean
  restored?: boolean
  meta?: string
  onReplace: (files: File[]) => void
  onRemove: () => void
}

function fileKindLabel(file: File): string {
  const type = file.type.trim()
  if (type && type !== 'application/octet-stream') return formatAcceptLabel(type)
  const extension = fileExtension(file.name)
  return extension ? formatAcceptLabel(extension) : 'FILE'
}

export function SelectedFiles({
  files,
  accept = [],
  multiple = false,
  maxFiles,
  maxFileSize = 100 * 1024 * 1024,
  disabled = false,
  restored = false,
  meta,
  onReplace,
  onRemove,
}: SelectedFilesProps) {
  const copy = useT()
  const inputRef = useRef<HTMLInputElement>(null)

  function replace(fileList: FileList | null) {
    if (!fileList || disabled) return
    const result = validateFiles(Array.from(fileList), {
      accept,
      multiple,
      maxFiles: multiple ? (maxFiles ?? Number.MAX_SAFE_INTEGER) : 1,
      maxFileSize,
    })
    if (result.files.length > 0) onReplace(result.files)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="selected-files">
      <p className="selected-files-status">
        <CheckCircle2 size={16} aria-hidden="true" />
        {restored ? copy.workspace.previousFileRestored : copy.workspace.fileReady}
      </p>
      <ul className="selected-files-list">
        {files.map((file, index) => (
          <li key={`${file.name}-${file.size}-${index}`}>
            <strong>{file.name}</strong>
            <span>{fileKindLabel(file)} · {formatBytes(file.size)}{meta ? ` · ${meta}` : ''}</span>
          </li>
        ))}
      </ul>
      <div className="button-row">
        <button className="button secondary" type="button" disabled={disabled} onClick={() => inputRef.current?.click()}>
          {files.length > 1 ? copy.workspace.replaceFiles : copy.workspace.replaceFile}
        </button>
        <button className="button ghost" type="button" disabled={disabled} onClick={onRemove}>
          {copy.workspace.remove}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept.length > 0 ? accept.join(',') : undefined}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => replace(event.target.files)}
      />
    </div>
  )
}
