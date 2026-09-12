import { describe, expect, it } from 'vitest'
import { createWorkReporter, isProcessStage, reportProcessStage, reportProcessTask, stagePercent, withProcessStages } from './process-stage'

describe('process stages', () => {
  it('accepts only named pipeline stages', () => {
    expect(isProcessStage('preparing')).toBe(true)
    expect(isProcessStage('compressing')).toBe(true)
    expect(isProcessStage('optimizing')).toBe(true)
    expect(isProcessStage('finalizing')).toBe(true)
    expect(isProcessStage('48%')).toBe(false)
  })

  it('maps completed work onto stage ranges', () => {
    expect(stagePercent('preparing', 0)).toBe(0)
    expect(stagePercent('preparing', 1)).toBe(10)
    expect(stagePercent('compressing', 0)).toBe(10)
    expect(stagePercent('compressing', 1)).toBe(75)
    expect(stagePercent('optimizing', 0)).toBe(75)
    expect(stagePercent('optimizing', 1)).toBe(95)
    expect(stagePercent('finalizing', 1)).toBe(100)
  })

  it('reports numeric progress for a completed stage fraction', async () => {
    const percents: number[] = []
    await reportProcessStage((progress) => {
      if (progress.progress != null) percents.push(progress.progress)
    }, 'optimizing', 0)
    expect(percents).toEqual([75])
  })

  it('interpolates within a stage from completed tasks', async () => {
    const percents: number[] = []
    await reportProcessTask((progress) => {
      if (progress.progress != null) percents.push(progress.progress)
    }, 'compressing', 1, 2)
    expect(percents).toEqual([43])
  })

  it('runs preparing, work, then finalizing in order', async () => {
    const stages: string[] = []
    const result = await withProcessStages((stage) => stages.push(stage), async () => 'ok')
    expect(result).toBe('ok')
    expect(stages).toEqual(['preparing', 'compressing', 'finalizing'])
  })

  it('emits work-unit percents from completed rows without inventing values', async () => {
    const percents: number[] = []
    const reporter = createWorkReporter((progress) => {
      if (progress.progress != null) percents.push(progress.progress)
    })
    reporter.setPlan(100)
    await reporter.setPhase('compressing', 'Encoding PNG...')
    for (let row = 0; row < 100; row += 1) await reporter.tickRows(row, 100)
    await reporter.complete()
    expect(percents[0]).toBe(0)
    expect(percents.at(-1)).toBe(100)
    expect(new Set(percents).size).toBeGreaterThan(8)
    for (let index = 1; index < percents.length; index += 1) {
      expect(percents[index] ?? 0).toBeGreaterThanOrEqual(percents[index - 1] ?? 0)
    }
  })
})
