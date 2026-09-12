import { PROCESS_STAGE_LABEL, PROCESS_STAGE_RANGE, type ProcessStage } from '@/processing/client/process-stage'

const BUSY_STAGES: Record<ProcessStage, boolean> = {
  preparing: true,
  compressing: true,
  optimizing: true,
  finalizing: true,
  completed: false,
  failed: false,
}

export function ProcessingProgressPanel({
  stage,
  title,
  percent = null,
  detail,
}: {
  stage: ProcessStage
  title: string
  percent?: number | null
  detail?: string
}) {
  const busy = BUSY_STAGES[stage]
  const label = detail ?? PROCESS_STAGE_LABEL[stage]
  const derived = percent == null && busy ? PROCESS_STAGE_RANGE[stage].start : percent
  const rounded = derived == null ? null : Math.max(0, Math.min(100, Math.round(derived)))
  return (
    <div className={`processing-progress${stage === 'failed' ? ' is-failed' : ''}${stage === 'completed' ? ' is-complete' : ''}`} role="status" aria-live="polite">
      <div className="processing-progress-head">
        <strong>{title}</strong>
        {rounded != null && <span>{rounded}%</span>}
      </div>
      {busy && (
        <div
          className="dropzone-track"
          role="progressbar"
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={100}
          {...(rounded == null ? { 'aria-valuetext': label } : { 'aria-valuenow': rounded })}
        >
          <div
            className={`dropzone-fill${rounded == null ? ' indeterminate' : ' determinate'}`}
            style={rounded == null ? undefined : { transform: `scaleX(${rounded / 100})` }}
          />
        </div>
      )}
      <p className="option-help">{label}</p>
    </div>
  )
}
