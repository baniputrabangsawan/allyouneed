import { describe, expect, it } from 'vitest'
import type { Job } from '@/lib/api/types'
import { JOB_FLOW_RANGE, resolveJobProgress } from './job-progress'

function job(partial: Partial<Job>): Job {
  return {
    jobId: 'job_1',
    status: 'processing',
    createdAt: '',
    updatedAt: '',
    progress: null,
    ...partial,
  }
}

describe('job progress', () => {
  it('maps upload bytes into 0-20%', () => {
    const start = resolveJobProgress({ transferStatus: 'uploading', uploadPercent: 0, job: null })
    const half = resolveJobProgress({ transferStatus: 'uploading', uploadPercent: 50, job: null })
    const done = resolveJobProgress({ transferStatus: 'uploading', uploadPercent: 100, job: null })
    expect(start.phase).toBe('uploading')
    expect(start.target).toBe(0)
    expect(half.target).toBe(10)
    expect(done.target).toBe(20)
    expect(done.ceiling).toBe(20)
  })

  it('keeps queued jobs in the preparing window', () => {
    const snapshot = resolveJobProgress({
      transferStatus: 'processing',
      job: job({ status: 'queued', stage: 'queued' }),
    })
    expect(snapshot.phase).toBe('queued')
    expect(snapshot.target).toBe(20)
    expect(snapshot.ceiling).toBe(34)
    expect(snapshot.label).toBe('Preparing')
  })

  it('uses backend percents when the job reports them', () => {
    const removing = resolveJobProgress({
      transferStatus: 'processing',
      job: job({ stage: 'removing-background', progress: 35 }),
    })
    const refining = resolveJobProgress({
      transferStatus: 'processing',
      job: job({ stage: 'refining-edges', progress: 70 }),
    })
    const finalizing = resolveJobProgress({
      transferStatus: 'processing',
      job: job({ stage: 'finalizing', progress: 85 }),
    })
    expect(removing.target).toBe(35)
    expect(removing.ceiling).toBe(69)
    expect(removing.label).toBe('Removing background')
    expect(refining.target).toBe(70)
    expect(refining.ceiling).toBe(84)
    expect(finalizing.phase).toBe('finalizing')
    expect(finalizing.target).toBe(85)
    expect(finalizing.ceiling).toBe(97)
  })

  it('falls back to stage floors when progress is missing', () => {
    const snapshot = resolveJobProgress({
      transferStatus: 'processing',
      job: job({ stage: 'removing-background', progress: null }),
    })
    expect(snapshot.target).toBe(35)
    expect(snapshot.ceiling).toBeLessThan(JOB_FLOW_RANGE.processing.end)
  })

  it('completes at 100 and holds on failure', () => {
    const done = resolveJobProgress({
      transferStatus: 'success',
      job: job({ status: 'completed', progress: 100, stage: 'finalizing' }),
    })
    const failed = resolveJobProgress({
      transferStatus: 'idle',
      job: job({ status: 'failed', progress: null }),
      failed: true,
    })
    expect(done.phase).toBe('completed')
    expect(done.target).toBe(100)
    expect(done.active).toBe(false)
    expect(failed.phase).toBe('failed')
    expect(failed.hold).toBe(true)
    expect(failed.active).toBe(false)
  })
})
