import { afterEach, describe, expect, it } from 'vitest'
import {
  createMemoryBackend,
  FilePersistenceService,
  fileFromBlob,
  isQuotaExceeded,
  sanitizePersistedOptions,
  sessionKey,
  setFilePersistence,
} from './file-persistence'

function pngFile(name = 'photo.png', size = 24): File {
  return new File([new Uint8Array(size)], name, { type: 'image/png', lastModified: 1_700_000_000_000 })
}

function service(now = 1_000, extras?: ConstructorParameters<typeof FilePersistenceService>[1]) {
  return new FilePersistenceService(createMemoryBackend(), extras, {
    now: () => now,
    randomId: () => 'id-1',
  })
}

afterEach(() => {
  setFilePersistence(undefined)
})

describe('sanitizePersistedOptions', () => {
  it('strips passwords, tokens, and blob urls', () => {
    expect(sanitizePersistedOptions({
      strength: 'medium',
      password: 'secret',
      apiKey: 'abc',
      preview: 'blob:http://localhost/abc',
      nested: { token: 'x', speed: 1.5 },
    })).toEqual({
      strength: 'medium',
      nested: { speed: 1.5 },
    })
  })
})

describe('FilePersistenceService', () => {
  it('keys sessions per tool slug', () => {
    expect(sessionKey('noise-reduction')).toBe('kits:file-session:noise-reduction')
  })

  it('restores a reconstructed File, not a stored blob URL', async () => {
    const persistence = service()
    const original = pngFile('recording.webm', 16)
    await persistence.saveLocalFile('noise-reduction', original, { strength: 'medium' })
    const restored = await persistence.restoreLocalFile('noise-reduction')
    expect(restored).toBeInstanceOf(File)
    expect(restored?.name).toBe('recording.webm')
    expect(restored?.size).toBe(16)
    expect(restored?.type).toBe('image/png')
    expect(restored?.lastModified).toBe(1_700_000_000_000)
    expect(restored).not.toBe(original)
  })

  it('does not leak files across tools', async () => {
    const persistence = service()
    await persistence.saveLocalFile('compress-image', pngFile('a.png'))
    expect(await persistence.restoreLocalFile('noise-reduction')).toBeUndefined()
    expect((await persistence.restoreLocalFile('compress-image'))?.name).toBe('a.png')
  })

  it('preserves multi-file order', async () => {
    const persistence = new FilePersistenceService(createMemoryBackend(), {}, {
      now: () => 1_000,
      randomId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })
    await persistence.saveLocalFiles({
      slug: 'merge-png',
      files: [pngFile('one.png', 8), pngFile('two.png', 12), pngFile('three.png', 4)],
      options: { layout: 'horizontal' },
    })
    const restored = await persistence.restoreLocalFiles('merge-png')
    expect(restored.files.map((file) => file.name)).toEqual(['one.png', 'two.png', 'three.png'])
    expect(restored.options).toEqual({ layout: 'horizontal' })
  })

  it('stores remote upload refs without extra blobs', async () => {
    const persistence = service()
    await persistence.saveRemoteUploadReference('noise-reduction', [{
      fileKey: 'uploads/2026/09/12/abc',
      name: 'recording.webm',
      size: 105_574,
      type: 'audio/webm',
    }], { strength: 'medium', password: 'nope' })
    const refs = await persistence.restoreRemoteUploadReference('noise-reduction')
    expect(refs).toEqual([expect.objectContaining({
      fileKey: 'uploads/2026/09/12/abc',
      name: 'recording.webm',
      size: 105_574,
    })])
    const restored = await persistence.restoreLocalFiles('noise-reduction')
    expect(restored.files).toEqual([])
    expect(restored.options).toEqual({ strength: 'medium' })
  })

  it('persists and clears a job id without duplicating files', async () => {
    const persistence = service()
    await persistence.saveLocalFile('noise-reduction', pngFile())
    await persistence.saveJobReference('noise-reduction', 'job-1')
    expect((await persistence.restoreLocalFiles('noise-reduction')).jobId).toBe('job-1')
    await persistence.saveJobReference('noise-reduction', null)
    expect((await persistence.restoreLocalFiles('noise-reduction')).jobId).toBeUndefined()
  })

  it('does not restore after clear', async () => {
    const persistence = service()
    await persistence.saveLocalFile('compress-image', pngFile())
    await persistence.clearToolSession('compress-image')
    expect(await persistence.restoreLocalFile('compress-image')).toBeUndefined()
  })

  it('expires sessions after the TTL', async () => {
    const backend = createMemoryBackend()
    const writer = new FilePersistenceService(backend, { ttlMs: 1_000 }, { now: () => 1_000, randomId: () => 'id-1' })
    await writer.saveLocalFile('compress-image', pngFile())
    const reader = new FilePersistenceService(backend, { ttlMs: 1_000 }, { now: () => 3_000, randomId: () => 'id-2' })
    const restored = await reader.restoreLocalFiles('compress-image')
    expect(restored.expired).toBe(true)
    expect(restored.files).toEqual([])
    expect(await reader.restoreLocalFile('compress-image')).toBeUndefined()
  })

  it('marks oversized files instead of storing their bytes', async () => {
    const persistence = service(1_000, { maxFileBytes: 10 })
    const saved = await persistence.saveLocalFile('compress-image', pngFile('huge.png', 64))
    expect(saved.tooLarge).toBe(true)
    const restored = await persistence.restoreLocalFiles('compress-image')
    expect(restored.tooLarge).toBe(true)
    expect(restored.files).toEqual([])
    expect(restored.metas[0]?.name).toBe('huge.png')
  })

  it('reconstructs files from stored blobs', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })
    const file = fileFromBlob(blob, { name: 'recording.webm', type: 'audio/webm', lastModified: 42 })
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('recording.webm')
    expect(file.size).toBe(3)
    expect(file.lastModified).toBe(42)
  })

  it('detects quota errors', () => {
    expect(isQuotaExceeded({ name: 'QuotaExceededError' })).toBe(true)
    expect(isQuotaExceeded(new Error('nope'))).toBe(false)
  })
})
