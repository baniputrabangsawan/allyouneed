import { useCallback, useEffect, useRef, useState } from 'react'
import { getJob, getJobResult } from '../api/jobs'
import { getUpload } from '../api/files'
import { ApiError } from '../api/client'
import type { Job } from '../api/types'
import {
  clearToolSession,
  getFilePersistence,
  type RestoreResult,
  type SaveLocalFilesInput,
} from './file-persistence'

export type FileRestoreNotice = 'restored' | 'too-large' | 'upload-missing' | 'resume-upload'

export interface ToolFileSessionState {
  restored: boolean
  notice: FileRestoreNotice | null
  job: Job | null
  options?: Record<string, unknown>
  download?: { url: string; filename: string }
}

export interface UseToolFileSessionOptions<TOptions> {
  slug: string
  applyFiles: (files: File[]) => void | Promise<void>
  applyOptions?: (options: TOptions) => void
  applyJob?: (job: Job | null) => void
  applyDownload?: (download: { url: string; filename: string } | null) => void
  resolveDownload?: (result: unknown) => { url: string; filename: string } | null
  onNotice?: (notice: FileRestoreNotice | null) => void
}

function isJob(value: unknown): value is Job {
  return typeof value === 'object' && value !== null && 'jobId' in value && 'status' in value
}

export function useToolFileSession<TOptions extends Record<string, unknown> = Record<string, unknown>>(
  options: UseToolFileSessionOptions<TOptions>,
) {
  const {
    slug,
    applyFiles,
    applyOptions,
    applyJob,
    applyDownload,
    resolveDownload,
    onNotice,
  } = options
  const [notice, setNotice] = useState<FileRestoreNotice | null>(null)
  const restoredRef = useRef(false)
  const applyFilesRef = useRef(applyFiles)
  const applyOptionsRef = useRef(applyOptions)
  const applyJobRef = useRef(applyJob)
  const applyDownloadRef = useRef(applyDownload)
  const resolveDownloadRef = useRef(resolveDownload)
  const onNoticeRef = useRef(onNotice)
  applyFilesRef.current = applyFiles
  applyOptionsRef.current = applyOptions
  applyJobRef.current = applyJob
  applyDownloadRef.current = applyDownload
  resolveDownloadRef.current = resolveDownload
  onNoticeRef.current = onNotice

  const publish = useCallback((next: FileRestoreNotice | null) => {
    setNotice(next)
    onNoticeRef.current?.(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    restoredRef.current = false

    async function restore() {
      const persistence = getFilePersistence()
      let restored: RestoreResult
      try {
        restored = await persistence.restoreLocalFiles(slug)
      } catch {
        restoredRef.current = true
        return
      }
      if (cancelled) {
        restoredRef.current = true
        return
      }

      if (restored.options && applyOptionsRef.current) {
        applyOptionsRef.current(restored.options as TOptions)
      }

      const uploads = restored.metas.filter((meta) => typeof meta.fileKey === 'string' && meta.fileKey.length > 0)
      let uploadsMissing = false
      if (uploads.length > 0) {
        let alive = 0
        for (const meta of uploads) {
          try {
            await getUpload(meta.fileKey!)
            alive += 1
          } catch (reason) {
            const gone = reason instanceof ApiError && (reason.status === 404 || reason.code === 'INVALID_FILE' || reason.code === 'UPLOAD_FAILED')
            if (!gone) alive += 1
          }
        }
        uploadsMissing = alive === 0
      }

      if (restored.files.length > 0) {
        await applyFilesRef.current(restored.files)
        if (cancelled) {
          restoredRef.current = true
          return
        }
        publish(restored.tooLarge ? 'too-large' : 'restored')
      } else if (restored.tooLarge) {
        publish('too-large')
      } else if (uploadsMissing) {
        await persistence.clearToolSession(slug)
        publish('upload-missing')
        restoredRef.current = true
        return
      } else if (uploads.length > 0) {
        publish('resume-upload')
      }

      if (restored.jobId && !uploadsMissing) {
        try {
          const job = await getJob(restored.jobId)
          if (cancelled) {
            restoredRef.current = true
            return
          }
          applyJobRef.current?.(job)
          if (job.status === 'completed') {
            const payload = await getJobResult<unknown>(job.jobId)
            const download = resolveDownloadRef.current?.(payload.result)
            if (download) applyDownloadRef.current?.(download)
          }
        } catch {
          await persistence.saveJobReference(slug, null)
        }
      }

      restoredRef.current = true
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [publish, slug])

  const persist = useCallback(async (input: Omit<SaveLocalFilesInput, 'slug'> & { files?: readonly File[] }) => {
    if (!restoredRef.current) return
    try {
      await getFilePersistence().saveLocalFiles({
        slug,
        files: input.files ?? [],
        ...(input.options ? { options: input.options } : {}),
        ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
        ...(input.uploads ? { uploads: input.uploads } : {}),
      })
    } catch {
      /* persistence must never block the tool */
    }
  }, [slug])

  const persistJob = useCallback(async (jobId: string | null) => {
    if (!restoredRef.current) return
    try {
      await getFilePersistence().saveJobReference(slug, jobId)
    } catch {
      /* ignore */
    }
  }, [slug])

  const persistUploads = useCallback(async (
    files: readonly File[],
    keys: readonly string[],
    toolOptions?: Record<string, unknown>,
  ) => {
    if (!restoredRef.current) return
    try {
      await getFilePersistence().saveRemoteUploadReference(
        slug,
        files.map((file, index) => ({
          fileKey: keys[index] ?? '',
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        })).filter((item) => item.fileKey.length > 0),
        toolOptions,
      )
    } catch {
      /* ignore */
    }
  }, [slug])

  const clear = useCallback(async () => {
    publish(null)
    try {
      await clearToolSession(slug)
    } catch {
      /* ignore */
    }
  }, [publish, slug])

  return { notice, persist, persistJob, persistUploads, clear, setNotice: publish }
}

export function isActiveJob(job: Job | null | undefined): job is Job {
  return isJob(job) && (job.status === 'queued' || job.status === 'processing')
}
