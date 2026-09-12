import { FileDropzone } from '@/components/file/FileDropzone'
import { SelectedFiles } from '@/features/workspaces/SelectedFiles'
import { useT } from '@/i18n'

export function SharedImageUpload({
  accept,
  files,
  previewUrl,
  width,
  height,
  restored = false,
  disabled = false,
  multiple = false,
  maxFiles,
  maxFileSize,
  onFilesSelected,
  onRemove,
}: {
  accept: readonly string[]
  files: readonly File[]
  previewUrl?: string
  width?: number
  height?: number
  restored?: boolean
  disabled?: boolean
  multiple?: boolean
  maxFiles?: number
  maxFileSize?: number
  onFilesSelected: (files: File[]) => void
  onRemove: () => void
}) {
  const copy = useT()
  if (files.length === 0) {
    return (
      <FileDropzone
        accept={accept}
        multiple={multiple}
        {...(maxFiles == null ? {} : { maxFiles })}
        {...(maxFileSize == null ? {} : { maxFileSize })}
        onFilesSelected={onFilesSelected}
      />
    )
  }
  const dimensions = width && height ? `${width}×${height}px` : undefined
  return (
    <div className="shared-image-upload">
      <SelectedFiles
        files={files}
        accept={accept}
        multiple={multiple}
        {...(maxFiles == null ? {} : { maxFiles })}
        {...(maxFileSize == null ? {} : { maxFileSize })}
        disabled={disabled}
        restored={restored}
        {...(dimensions ? { meta: dimensions } : {})}
        onReplace={onFilesSelected}
        onRemove={onRemove}
      />
      {previewUrl ? (
        <div className="image-stage shared-image-upload-preview">
          <img src={previewUrl} alt={copy.workspace.originalAlt} />
        </div>
      ) : null}
    </div>
  )
}
