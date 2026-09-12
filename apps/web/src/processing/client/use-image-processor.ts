import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProcessingProgress } from '@/processing/types/processing'
import { isProcessStage, type ProcessStage } from './process-stage'
import { runImageJob } from './image-processor'
import type { ImageJob, ImageJobResult } from './image-processor-protocol'

export function useImageProcessor() {
  const generationRef = useRef(0)
  const [stage, setStage] = useState<ProcessStage>('preparing')
  const [percent, setPercent] = useState<number | null>(null)

  useEffect(() => () => {
    generationRef.current += 1
  }, [])

  const reset = useCallback(() => {
    generationRef.current += 1
    setStage('preparing')
    setPercent(null)
  }, [])

  const run = useCallback(async (job: ImageJob): Promise<ImageJobResult> => {
    const generation = generationRef.current
    setStage('preparing')
    setPercent(0)
    return runImageJob(job, (progress: ProcessingProgress) => {
      if (generation !== generationRef.current) return
      if (isProcessStage(progress.stage) && progress.stage !== 'completed' && progress.stage !== 'failed') {
        setStage(progress.stage)
      }
      if (progress.progress != null) setPercent(progress.progress)
    })
  }, [])

  return { run, reset, stage, percent, setStage, setPercent }
}
