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
