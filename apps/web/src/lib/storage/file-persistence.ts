export const FILE_SESSION_KEY_PREFIX = 'kits:file-session:'
export const FILE_PERSISTENCE_DB = 'kits-file-sessions'
export const FILE_PERSISTENCE_VERSION = 1
export const SESSIONS_STORE = 'sessions'
export const BLOBS_STORE = 'blobs'

export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000
export const DEFAULT_MAX_FILE_BYTES = 32 * 1024 * 1024
export const DEFAULT_MAX_SESSION_BYTES = 64 * 1024 * 1024

const SENSITIVE_KEY =
  /^(password|passwd|pwd|passphrase|token|secret|api[_-]?key|totp|otp|private[_-]?key|credential|credentials|license|entitlement|csrf|session|authorization|auth)$/i

export interface FilePersistenceLimits {
  ttlMs: number
  maxFileBytes: number
  maxSessionBytes: number
}

export interface PersistedFileMeta {
  id: string
  name: string
  size: number
  type: string
  lastModified: number
  blobId?: string
  fileKey?: string
}

export interface ToolFileSession {
  version: 1
  key: string
  slug: string
  savedAt: number
  files: PersistedFileMeta[]
  options?: Record<string, unknown>
  jobId?: string
  tooLarge?: boolean
}

export interface RestoredFile extends PersistedFileMeta {
  file?: File
}

export interface RestoreResult {
  session: ToolFileSession | null
  files: File[]
  metas: RestoredFile[]
  options?: Record<string, unknown>
  jobId?: string
  tooLarge: boolean
  expired: boolean
}

export interface PersistenceBackend {
  getSession(key: string): Promise<ToolFileSession | undefined>
  putSession(session: ToolFileSession): Promise<void>
  deleteSession(key: string): Promise<void>
  listSessions(): Promise<ToolFileSession[]>
  getBlob(id: string): Promise<Blob | undefined>
  putBlob(id: string, blob: Blob): Promise<void>
  deleteBlob(id: string): Promise<void>
}

export interface StorageEstimate {
  usage?: number
  quota?: number
}

export interface FilePersistenceHost {
  now: () => number
  randomId: () => string
  estimateStorage?: () => Promise<StorageEstimate | undefined>
}

export interface SaveLocalFilesInput {
  slug: string
  files: readonly File[]
  options?: Record<string, unknown>
  jobId?: string | null
  uploads?: readonly (string | undefined | null)[]
}

const defaultLimits: FilePersistenceLimits = {
  ttlMs: DEFAULT_TTL_MS,
  maxFileBytes: DEFAULT_MAX_FILE_BYTES,
  maxSessionBytes: DEFAULT_MAX_SESSION_BYTES,
}

const defaultHost: FilePersistenceHost = {
  now: () => Date.now(),
  randomId: () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
  },
  estimateStorage: async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return undefined
      const estimate = await navigator.storage.estimate()
      const result: StorageEstimate = {}
      if (estimate.usage !== undefined) result.usage = estimate.usage
      if (estimate.quota !== undefined) result.quota = estimate.quota
      return result
    } catch {
      return undefined
    }
  },
}

export function sessionKey(slug: string): string {
  return `${FILE_SESSION_KEY_PREFIX}${slug}`
}

export function isQuotaExceeded(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false
  const error = reason as { name?: string; code?: number }
  return error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014
}

export function sanitizePersistedOptions(value: unknown): Record<string, unknown> | undefined {
  const cleaned = sanitizeValue(value)
  if (!isRecord(cleaned)) return undefined
  return cleaned
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('blob:')) return undefined
    if (value.startsWith('data:') && value.length > 1024) return undefined
    return value
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue).filter((item) => item !== undefined)
  }
  if (!isRecord(value)) {
    if (value === null) return null
    if (typeof value === 'number' || typeof value === 'boolean') return value
    return undefined
  }
  const next: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) continue
    const cleaned = sanitizeValue(child)
    if (cleaned !== undefined) next[key] = cleaned
  }
  return next
}

export function fileFromBlob(blob: Blob, meta: Pick<PersistedFileMeta, 'name' | 'type' | 'lastModified'>): File {
  return new File([blob], meta.name, { type: meta.type, lastModified: meta.lastModified })
}

export function createMemoryBackend(): PersistenceBackend {
  const sessions = new Map<string, ToolFileSession>()
  const blobs = new Map<string, Blob>()
  return {
    getSession: async (key) => sessions.get(key),
    putSession: async (session) => {
      sessions.set(session.key, session)
    },
    deleteSession: async (key) => {
      sessions.delete(key)
    },
    listSessions: async () => [...sessions.values()],
    getBlob: async (id) => blobs.get(id),
    putBlob: async (id, blob) => {
      blobs.set(id, blob)
    },
    deleteBlob: async (id) => {
      blobs.delete(id)
    },
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'))
  })
}

async function openPersistenceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_PERSISTENCE_DB, FILE_PERSISTENCE_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) db.createObjectStore(SESSIONS_STORE, { keyPath: 'key' })
      if (!db.objectStoreNames.contains(BLOBS_STORE)) db.createObjectStore(BLOBS_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB is unavailable.'))
  })
}

export function createIndexedDbBackend(): PersistenceBackend {
  let dbPromise: Promise<IDBDatabase> | undefined
  const db = () => {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable.'))
    dbPromise ??= openPersistenceDb()
    return dbPromise
  }

  return {
    async getSession(key) {
      const store = (await db()).transaction(SESSIONS_STORE, 'readonly').objectStore(SESSIONS_STORE)
      return await requestToPromise(store.get(key) as IDBRequest<ToolFileSession | undefined>)
    },
    async putSession(session) {
      const tx = (await db()).transaction(SESSIONS_STORE, 'readwrite')
      tx.objectStore(SESSIONS_STORE).put(session)
      await transactionDone(tx)
    },
    async deleteSession(key) {
      const tx = (await db()).transaction(SESSIONS_STORE, 'readwrite')
      tx.objectStore(SESSIONS_STORE).delete(key)
      await transactionDone(tx)
    },
    async listSessions() {
      const store = (await db()).transaction(SESSIONS_STORE, 'readonly').objectStore(SESSIONS_STORE)
      return (await requestToPromise(store.getAll() as IDBRequest<ToolFileSession[]>)) ?? []
    },
    async getBlob(id) {
      const store = (await db()).transaction(BLOBS_STORE, 'readonly').objectStore(BLOBS_STORE)
      return await requestToPromise(store.get(id) as IDBRequest<Blob | undefined>)
    },
    async putBlob(id, blob) {
      const tx = (await db()).transaction(BLOBS_STORE, 'readwrite')
      tx.objectStore(BLOBS_STORE).put(blob, id)
      await transactionDone(tx)
    },
    async deleteBlob(id) {
      const tx = (await db()).transaction(BLOBS_STORE, 'readwrite')
      tx.objectStore(BLOBS_STORE).delete(id)
      await transactionDone(tx)
    },
  }
}

export class FilePersistenceService {
  private readonly limits: FilePersistenceLimits
  private readonly host: FilePersistenceHost

  constructor(
    private readonly backend: PersistenceBackend,
    limits: Partial<FilePersistenceLimits> = {},
    host: Partial<FilePersistenceHost> = {},
  ) {
    this.limits = { ...defaultLimits, ...limits }
    this.host = { ...defaultHost, ...host }
  }

  sessionKey(slug: string): string {
    return sessionKey(slug)
  }

  async saveLocalFile(slug: string, file: File, options?: Record<string, unknown>): Promise<ToolFileSession> {
    return await this.saveLocalFiles({ slug, files: [file], ...(options ? { options } : {}) })
  }

  async saveLocalFiles(input: SaveLocalFilesInput): Promise<ToolFileSession> {
    const key = sessionKey(input.slug)
    const previous = await this.safeGetSession(key)
    await this.deleteSessionBlobs(previous)

    const files: PersistedFileMeta[] = []
    let tooLarge = false
    let storedBytes = 0
    const estimate = await this.host.estimateStorage?.()
    const remainingQuota = remainingBytes(estimate)

    for (const [index, file] of input.files.entries()) {
      const id = this.host.randomId()
      const meta: PersistedFileMeta = {
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      }
      const fileKey = input.uploads?.[index]
      if (typeof fileKey === 'string' && fileKey.length > 0) meta.fileKey = fileKey

      const canStoreBlob = file.size <= this.limits.maxFileBytes
        && storedBytes + file.size <= this.limits.maxSessionBytes
        && (remainingQuota === undefined || storedBytes + file.size <= remainingQuota)
      if (!canStoreBlob) {
        tooLarge = true
        files.push(meta)
        continue
      }
      try {
        const blobId = `${input.slug}:${id}`
        await this.backend.putBlob(blobId, file)
        storedBytes += file.size
        files.push({ ...meta, blobId })
      } catch (reason) {
        if (isQuotaExceeded(reason)) {
          tooLarge = true
          files.push(meta)
          continue
        }
        throw reason
      }
    }

    const session: ToolFileSession = {
      version: 1,
      key,
      slug: input.slug,
      savedAt: this.host.now(),
      files,
    }
    const options = sanitizePersistedOptions(input.options)
    if (options) session.options = options
    if (typeof input.jobId === 'string' && input.jobId.length > 0) session.jobId = input.jobId
    if (tooLarge) session.tooLarge = true

    try {
      await this.backend.putSession(session)
    } catch (reason) {
      if (!isQuotaExceeded(reason)) throw reason
      const metadataOnly: ToolFileSession = {
        ...session,
        files: session.files.map(({ blobId, ...meta }) => {
          void blobId
          return meta
        }),
        tooLarge: true,
      }
      await this.deleteSessionBlobs(session)
      await this.backend.putSession(metadataOnly)
      return metadataOnly
    }
    return session
  }

  async restoreLocalFile(slug: string): Promise<File | undefined> {
    const restored = await this.restoreLocalFiles(slug)
    return restored.files[0]
  }

  async restoreLocalFiles(slug: string): Promise<RestoreResult> {
    const key = sessionKey(slug)
    const session = await this.safeGetSession(key)
    if (!session) {
      return { session: null, files: [], metas: [], tooLarge: false, expired: false }
    }
    if (this.isExpired(session)) {
      await this.clearToolSession(slug)
      return { session: null, files: [], metas: [], tooLarge: false, expired: true }
    }

    const files: File[] = []
    const metas: RestoredFile[] = []
    for (const meta of session.files) {
      let file: File | undefined
      if (meta.blobId) {
        try {
          const blob = await this.backend.getBlob(meta.blobId)
          if (blob) file = fileFromBlob(blob, meta)
        } catch {
          file = undefined
        }
      }
      if (file) files.push(file)
      metas.push(file ? { ...meta, file } : { ...meta })
    }

    const result: RestoreResult = {
      session,
      files,
      metas,
      tooLarge: session.tooLarge === true,
      expired: false,
    }
    if (session.options) result.options = session.options
    if (session.jobId) result.jobId = session.jobId
    return result
  }

  async saveRemoteUploadReference(
    slug: string,
    uploads: readonly { fileKey: string; name: string; size: number; type: string; lastModified?: number }[],
    options?: Record<string, unknown>,
  ): Promise<ToolFileSession> {
    const key = sessionKey(slug)
    const previous = await this.safeGetSession(key)
    const files: PersistedFileMeta[] = uploads.map((upload, index) => {
      const existing = previous?.files[index]
      const meta: PersistedFileMeta = {
        id: existing?.id ?? this.host.randomId(),
        name: upload.name,
        size: upload.size,
        type: upload.type,
        lastModified: upload.lastModified ?? existing?.lastModified ?? this.host.now(),
        fileKey: upload.fileKey,
      }
      if (existing?.blobId) meta.blobId = existing.blobId
      return meta
    })
    const session: ToolFileSession = {
      version: 1,
      key,
      slug,
      savedAt: this.host.now(),
      files,
    }
    const sanitized = sanitizePersistedOptions(options ?? previous?.options)
    if (sanitized) session.options = sanitized
    if (previous?.jobId) session.jobId = previous.jobId
    if (previous?.tooLarge) session.tooLarge = true
    await this.backend.putSession(session)
    return session
  }

  async restoreRemoteUploadReference(slug: string): Promise<PersistedFileMeta[]> {
    const restored = await this.restoreLocalFiles(slug)
    return restored.metas.filter((meta) => typeof meta.fileKey === 'string' && meta.fileKey.length > 0)
  }

  async saveJobReference(slug: string, jobId: string | null): Promise<void> {
    const key = sessionKey(slug)
    const previous = await this.safeGetSession(key)
    if (!previous) return
    const session: ToolFileSession = {
      version: 1,
      key: previous.key,
      slug: previous.slug,
      savedAt: this.host.now(),
      files: previous.files,
    }
    if (previous.options) session.options = previous.options
    if (typeof jobId === 'string' && jobId.length > 0) session.jobId = jobId
    if (previous.tooLarge) session.tooLarge = true
    await this.backend.putSession(session)
  }

  async clearToolSession(slug: string): Promise<void> {
    const key = sessionKey(slug)
    const previous = await this.safeGetSession(key)
    await this.deleteSessionBlobs(previous)
    try {
      await this.backend.deleteSession(key)
    } catch {
      /* storage unavailable */
    }
  }

  async cleanupExpiredFiles(now = this.host.now()): Promise<number> {
    let removed = 0
    let sessions: ToolFileSession[] = []
    try {
      sessions = await this.backend.listSessions()
    } catch {
      return 0
    }
    for (const session of sessions) {
      if (!this.isExpired(session, now)) continue
      await this.deleteSessionBlobs(session)
      try {
        await this.backend.deleteSession(session.key)
        removed += 1
      } catch {
        /* ignore individual failures */
      }
    }
    return removed
  }

  private isExpired(session: ToolFileSession, now = this.host.now()): boolean {
    return now - session.savedAt > this.limits.ttlMs
  }

  private async safeGetSession(key: string): Promise<ToolFileSession | undefined> {
    try {
      const session = await this.backend.getSession(key)
      if (!session || session.version !== 1 || !Array.isArray(session.files)) return undefined
      return session
    } catch {
      return undefined
    }
  }

  private async deleteSessionBlobs(session: ToolFileSession | undefined): Promise<void> {
    if (!session) return
    for (const file of session.files) {
      if (!file.blobId) continue
      try {
        await this.backend.deleteBlob(file.blobId)
      } catch {
        /* ignore */
      }
    }
  }
}

function remainingBytes(estimate: StorageEstimate | undefined): number | undefined {
  if (!estimate || estimate.quota === undefined || estimate.usage === undefined) return undefined
  return Math.max(0, Math.floor(estimate.quota * 0.9 - estimate.usage))
}

let defaultService: FilePersistenceService | undefined

export function getFilePersistence(): FilePersistenceService {
  if (!defaultService) {
    const backend = typeof indexedDB === 'undefined' ? createMemoryBackend() : createIndexedDbBackend()
    defaultService = new FilePersistenceService(backend)
  }
  return defaultService
}

export function setFilePersistence(service: FilePersistenceService | undefined): void {
  defaultService = service
}

export async function saveLocalFile(slug: string, file: File, options?: Record<string, unknown>): Promise<ToolFileSession> {
  return await getFilePersistence().saveLocalFile(slug, file, options)
}

export async function restoreLocalFile(slug: string): Promise<File | undefined> {
  return await getFilePersistence().restoreLocalFile(slug)
}

export async function saveLocalFiles(input: SaveLocalFilesInput): Promise<ToolFileSession> {
  return await getFilePersistence().saveLocalFiles(input)
}

export async function restoreLocalFiles(slug: string): Promise<RestoreResult> {
  return await getFilePersistence().restoreLocalFiles(slug)
}

export async function saveRemoteUploadReference(
  slug: string,
  uploads: readonly { fileKey: string; name: string; size: number; type: string; lastModified?: number }[],
  options?: Record<string, unknown>,
): Promise<ToolFileSession> {
  return await getFilePersistence().saveRemoteUploadReference(slug, uploads, options)
}

export async function restoreRemoteUploadReference(slug: string): Promise<PersistedFileMeta[]> {
  return await getFilePersistence().restoreRemoteUploadReference(slug)
}

export async function saveJobReference(slug: string, jobId: string | null): Promise<void> {
  return await getFilePersistence().saveJobReference(slug, jobId)
}

export async function clearToolSession(slug: string): Promise<void> {
  return await getFilePersistence().clearToolSession(slug)
}

export async function cleanupExpiredFiles(): Promise<number> {
  return await getFilePersistence().cleanupExpiredFiles()
}
