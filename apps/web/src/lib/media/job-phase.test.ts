import { describe, expect, it } from 'vitest'
import { remoteJobPhase } from './job-phase'

describe('remote job phase', () => {
  it('shows Processing server unavailable when the API cannot be reached', () => {
    expect(remoteJobPhase('idle', null, 'API_UNREACHABLE')).toBe('unavailable')
  })

  it('keeps queue and ffmpeg failures as failed, not unreachable', () => {
    expect(remoteJobPhase('idle', null, 'QUEUE_UNAVAILABLE')).toBe('failed')
    expect(remoteJobPhase('idle', { status: 'failed' } as never, 'FFMPEG_FAILED')).toBe('failed')
  })

  it('follows upload and job status otherwise', () => {
    expect(remoteJobPhase('idle', null, null)).toBe('ready')
    expect(remoteJobPhase('uploading', null, null)).toBe('uploading')
    expect(remoteJobPhase('processing', { status: 'queued' } as never, null)).toBe('queued')
    expect(remoteJobPhase('processing', { status: 'processing' } as never, null)).toBe('processing')
    expect(remoteJobPhase('success', { status: 'completed' } as never, null)).toBe('completed')
    expect(remoteJobPhase('idle', { status: 'cancelled' } as never, null)).toBe('cancelled')
  })
})
