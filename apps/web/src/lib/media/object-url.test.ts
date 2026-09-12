import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncObjectUrls } from './object-url'

describe('syncObjectUrls', () => {
  const create = vi.fn((file: File) => `blob:${file.name}`)
  const revoke = vi.fn()

  afterEach(() => {
    create.mockClear()
    revoke.mockClear()
  })

  it('creates one URL per file and reuses it', () => {
    const a = new File([new Uint8Array([1])], 'a.webm', { type: 'audio/webm' })
    const first = syncObjectUrls(new Map(), [a], create, revoke)
    expect(create).toHaveBeenCalledTimes(1)
    expect(first.get(a)).toBe('blob:a.webm')
    const second = syncObjectUrls(first, [a], create, revoke)
    expect(create).toHaveBeenCalledTimes(1)
    expect(revoke).not.toHaveBeenCalled()
    expect(second.get(a)).toBe('blob:a.webm')
  })

  it('revokes the previous URL when the file is replaced', () => {
    const a = new File([new Uint8Array([1])], 'a.webm', { type: 'audio/webm' })
    const b = new File([new Uint8Array([2])], 'b.wav', { type: 'audio/wav' })
    const first = syncObjectUrls(new Map(), [a], create, revoke)
    const second = syncObjectUrls(first, [b], create, revoke)
    expect(revoke).toHaveBeenCalledWith('blob:a.webm')
    expect(second.get(a)).toBeUndefined()
    expect(second.get(b)).toBe('blob:b.wav')
  })

  it('revokes remaining URLs when cleared', () => {
    const a = new File([new Uint8Array([1])], 'a.webm', { type: 'audio/webm' })
    const first = syncObjectUrls(new Map(), [a], create, revoke)
    const empty = syncObjectUrls(first, [], create, revoke)
    expect(revoke).toHaveBeenCalledWith('blob:a.webm')
    expect(empty.size).toBe(0)
  })
})
