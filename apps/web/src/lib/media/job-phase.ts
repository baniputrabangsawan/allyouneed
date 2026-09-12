import type { DropzoneStatus } from '../../components/file/FileDropzone'
import type { Job } from '../api/types'
import type { WorkflowErrorCode } from './workflow-error'

export type RemoteJobPhase =
  | 'ready'
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'unavailable'

export function remoteJobPhase(
  transferStatus: DropzoneStatus,
  job: Job | null,
  errorCode: WorkflowErrorCode | null,
): RemoteJobPhase {
  if (errorCode === 'API_UNREACHABLE') return 'unavailable'
  if (job?.status === 'cancelled') return 'cancelled'
  if (errorCode || job?.status === 'failed') return 'failed'
  if (transferStatus === 'uploading') return 'uploading'
  if (job?.status === 'queued') return 'queued'
  if (job?.status === 'processing' || transferStatus === 'processing') return 'processing'
  if (job?.status === 'completed' || transferStatus === 'success') return 'completed'
  return 'ready'
}
