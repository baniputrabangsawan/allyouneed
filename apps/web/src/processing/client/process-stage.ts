import type { ProcessingProgress } from '@/processing/types/processing'

export type ProcessStage = 'preparing' | 'compressing' | 'optimizing' | 'finalizing' | 'completed' | 'failed'

export const PROCESS_STAGE_LABEL: Record<ProcessStage, string> = {
  preparing: 'Preparing',
  compressing: 'Compressing',
  optimizing: 'Optimizing image data...',
  finalizing: 'Finalizing',
  completed: 'Completed',
  failed: 'Failed',
}

export const PROCESS_STAGE_RANGE: Record<ProcessStage, { start: number; end: number }> = {
  preparing: { start: 0, end: 10 },
  compressing: { start: 10, end: 75 },
  optimizing: { start: 75, end: 95 },
  finalizing: { start: 95, end: 100 },
  completed: { start: 100, end: 100 },
  failed: { start: 0, end: 0 },
}

export function isProcessStage(value: string | undefined): value is ProcessStage {
  return value === 'preparing' || value === 'compressing' || value === 'optimizing' || value === 'finalizing' || value === 'completed' || value === 'failed'
}

export function stagePercent(stage: ProcessStage, fraction = 0): number {
  const range = PROCESS_STAGE_RANGE[stage]
  const clamped = Math.min(1, Math.max(0, fraction))
  return Math.round(range.start + (range.end - range.start) * clamped)
}

export function yieldToUi(): Promise<void> {
  if (typeof self !== 'undefined' && 'importScripts' in self) return Promise.resolve()
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 0)
  })
}

export async function reportProcessStage(
  onProgress: ((progress: ProcessingProgress) => void) | undefined,
  stage: ProcessStage,
  fraction = 0,
): Promise<void> {
  if (!onProgress) return
  onProgress({ progress: stagePercent(stage, fraction), stage })
  await yieldToUi()
}

export async function reportProcessTask(
  onProgress: ((progress: ProcessingProgress) => void) | undefined,
  stage: ProcessStage,
  current: number,
  total: number,
): Promise<void> {
  if (!onProgress) return
  const fraction = total > 0 ? current / total : 0
  onProgress({ progress: stagePercent(stage, fraction), stage, current, total })
  await yieldToUi()
}

export async function withProcessStages<T>(
  setStage: (stage: ProcessStage) => void,
  work: () => Promise<T>,
  options: { optimize?: boolean } = {},
): Promise<T> {
  setStage('preparing')
  await yieldToUi()
  setStage(options.optimize ? 'optimizing' : 'compressing')
  await yieldToUi()
  const result = await work()
  setStage('finalizing')
  await yieldToUi()
  return result
}

const PROGRESS_INTERVAL_MS = 40
const ROW_STRIDE = 16

export type RowProgress = (row: number, rows: number) => void | Promise<void>

export interface WorkReporter {
  readonly total: number
  completed: number
  setPlan(total: number): void
  setPhase(stage: ProcessStage, label: string): Promise<void>
  add(units: number): Promise<void>
  tickRows(row: number, rows: number, unitsPerRow?: number): Promise<void>
  complete(): Promise<void>
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function createWorkReporter(onProgress?: (progress: ProcessingProgress) => void): WorkReporter {
  let completed = 0
  let total = 1
  let stage: ProcessStage = 'preparing'
  let label = 'Preparing image...'
  let lastTs = 0
  let lastPercent = -1

  function percent(): number {
    if (total <= 0) return 0
    return Math.max(0, Math.min(100, Math.round((100 * completed) / total)))
  }

  async function emit(force = false): Promise<void> {
    if (!onProgress) return
    const value = percent()
    const ts = nowMs()
    if (!force && value < 100 && value - lastPercent < 1 && ts - lastTs < PROGRESS_INTERVAL_MS) {
      await yieldToUi()
      return
    }
    lastTs = ts
    lastPercent = value
    onProgress({ progress: value, stage, label, current: completed, total })
    await yieldToUi()
  }

  const reporter: WorkReporter = {
    get total() {
      return total
    },
    get completed() {
      return completed
    },
    set completed(value: number) {
      completed = value
    },
    setPlan(nextTotal: number) {
      total = Math.max(1, nextTotal)
    },
    async setPhase(nextStage: ProcessStage, nextLabel: string) {
      stage = nextStage
      label = nextLabel
      await emit(true)
    },
    async add(units: number) {
      completed = Math.min(total, completed + units)
      await emit()
    },
    async tickRows(row: number, rows: number, unitsPerRow = 1) {
      completed = Math.min(total, completed + unitsPerRow)
      if (!onProgress) return
      if (row % ROW_STRIDE === 0 || row === rows - 1) await emit()
    },
    async complete() {
      completed = total
      stage = 'finalizing'
      label = 'Completed'
      await emit(true)
    },
  }
  return reporter
}

export async function forEachRow(rows: number, visit: (row: number) => void | Promise<void>, onRow?: RowProgress): Promise<void> {
  for (let row = 0; row < rows; row += 1) {
    await visit(row)
    if (onRow) await onRow(row, rows)
  }
}
