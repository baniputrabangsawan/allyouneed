import { useEffect, useState } from 'react'
import { shouldAutoDownload } from '@/features/image/image-result'
import { autoDownloadOnce } from './auto-download'

export function useAutoDownloadResult(options: {
  id?: string | null | undefined
  source?: Blob | string | null | undefined
  filename?: string | null | undefined
  enabled?: boolean | undefined
  restored?: boolean | undefined
}): boolean {
  const [attempted, setAttempted] = useState(false)
  const id = options.id ?? ''
  const source = options.source ?? null
  const filename = options.filename ?? ''
  const eligible = shouldAutoDownload({
    id,
    source,
    filename,
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    ...(options.restored === undefined ? {} : { restored: options.restored }),
  })

  useEffect(() => {
    if (!eligible || !id || source == null || !filename) {
      setAttempted(false)
      return
    }
    setAttempted(autoDownloadOnce(id, source, filename))
  }, [eligible, id, source, filename])

  return attempted
}
