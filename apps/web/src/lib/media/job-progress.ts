import { useEffect, useRef, useState } from 'react'
import type { DropzoneStatus } from '@/components/file/FileDropzone'
import type { Job, JobStatus } from '@/lib/api/types'
import { prefersReducedMotion } from '@/lib/motion/prefers-reduced-motion'

export type JobFlowPhase =
  | 'idle'
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export const JOB_FLOW_RANGE: Record<JobFlowPhase, { start: number; end: number }> = {
  idle: { start: 0, end: 0 },
  uploading: { start: 0, end: 20 },
  queued: { start: 20, end: 35 },
  processing: { start: 35, end: 85 },
  finalizing: { start: 85, end: 97 },
  completed: { start: 100, end: 100 },
  failed: { start: 0, end: 0 },
  cancelled: { start: 0, end: 0 },
}

export const JOB_FLOW_LABEL: Record<JobFlowPhase, string> = {
  idle: 'Ready',
  uploading: 'Uploading',
  queued: 'Preparing',
  processing: 'Removing background',
  finalizing: 'Finalizing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export interface JobFlowSnapshot {
  phase: JobFlowPhase
  label: string
  target: number
  ceiling: number
  active: boolean
  hold: boolean
}

export interface JobFlowInput {
  transferStatus: DropzoneStatus
  uploadPercent?: number | null
  job: Job | null
  failed?: boolean
}

const STAGE_LABEL: Record<string, string> = {
  downloading: 'Uploading',
  queued: 'Preparing',
  processing: 'Preparing',
  'removing-background': 'Removing background',
  'refining-edges': 'Refining edges',
  finalizing: 'Finalizing',
}

export function jobFlowPhase(input: JobFlowInput): JobFlowPhase {
  const status = input.job?.status
  const stage = input.job?.stage
  if (input.failed || status === 'failed') return 'failed'
  if (status === 'cancelled' || status === 'expired') return 'cancelled'
  if (status === 'completed' || input.transferStatus === 'success') return 'completed'
  if (input.transferStatus === 'uploading') return 'uploading'
  if (stage === 'finalizing') return 'finalizing'
  if (stage === 'removing-background' || stage === 'refining-edges') return 'processing'
  if (status === 'queued') return 'queued'
  if (status === 'processing' || input.transferStatus === 'processing') {
    if (stage === 'downloading') return 'uploading'
    if (!stage || stage === 'queued') return 'queued'
    return 'processing'
  }
  return 'idle'
}

export function resolveJobProgress(input: JobFlowInput): JobFlowSnapshot {
  const phase = jobFlowPhase(input)
  const range = JOB_FLOW_RANGE[phase]
  const label = stageLabel(input.job?.stage) ?? JOB_FLOW_LABEL[phase]
  if (phase === 'idle') {
    return { phase, label, target: 0, ceiling: 0, active: false, hold: false }
  }
  if (phase === 'failed' || phase === 'cancelled') {
    return { phase, label, target: 0, ceiling: 0, active: false, hold: true }
  }
  if (phase === 'completed') {
    return { phase, label, target: 100, ceiling: 100, active: false, hold: false }
  }
  if (phase === 'uploading') {
    const fraction = clamp((input.uploadPercent ?? 0) / 100)
    const target = roundProgress(range.start + (range.end - range.start) * fraction)
    return { phase, label, target, ceiling: target, active: true, hold: false }
  }
  const reported = numericProgress(input.job)
  const floor = stageFloor(input.job?.stage, range.start)
  const target = roundProgress(Math.max(floor, reported ?? floor))
  const ceiling = crawlCeiling(phase, input.job?.stage, input.job?.status)
  return {
    phase,
    label,
    target: Math.min(target, ceiling),
    ceiling,
    active: true,
    hold: false,
  }
}

export function useSmoothedJobProgress(snapshot: JobFlowSnapshot, resetKey: string | number): number {
  const [value, setValue] = useState(0)
  const valueRef = useRef(0)

  useEffect(() => {
    valueRef.current = 0
    setValue(0)
  }, [resetKey])

  useEffect(() => {
    if (snapshot.hold) return
    if (!snapshot.active) {
      valueRef.current = snapshot.target
      setValue(snapshot.target)
      return
    }
    if (prefersReducedMotion()) {
      valueRef.current = snapshot.target
      setValue(snapshot.target)
      return
    }

    const tick = () => {
      const current = valueRef.current
      const goal = Math.min(snapshot.ceiling, Math.max(snapshot.target, current))
      const catchingUp = snapshot.target > current + 0.4
      const next = catchingUp
        ? current + (goal - current) * 0.28
        : Math.min(snapshot.ceiling, current + 0.35)
      const clamped = roundProgress(Math.max(current, next))
      if (clamped !== current) {
        valueRef.current = clamped
        setValue(clamped)
      }
    }

    tick()
    const id = window.setInterval(tick, 80)
    return () => window.clearInterval(id)
  }, [snapshot.active, snapshot.ceiling, snapshot.hold, snapshot.target])

  return value
}

function stageLabel(stage?: string): string | undefined {
  if (!stage) return undefined
  return STAGE_LABEL[stage]
}

function stageFloor(stage: string | undefined, fallback: number): number {
  if (stage === 'refining-edges') return 70
  if (stage === 'finalizing') return 85
  if (stage === 'removing-background') return 35
  return fallback
}

function crawlCeiling(phase: JobFlowPhase, stage: string | undefined, status?: JobStatus): number {
  if (phase === 'queued') return 34
  if (stage === 'refining-edges') return 84
  if (stage === 'removing-background') return 69
  if (phase === 'finalizing') return 97
  if (phase === 'processing' || status === 'processing') return 84
  return JOB_FLOW_RANGE[phase].end
}

function numericProgress(job: Job | null): number | null {
  if (job?.progress == null || !Number.isFinite(job.progress)) return null
  return clamp(job.progress)
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function roundProgress(value: number): number {
  return Math.round(clamp(value) * 10) / 10
}
