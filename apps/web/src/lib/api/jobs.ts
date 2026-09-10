import { apiClient, type ApiClient, type ApiRequestOptions } from './client'
import type { ApiResponse, CreateJobRequest, Job, JobResult } from './types'

const jobPath = (jobId: string, suffix = '') => `/api/v1/jobs/${encodeURIComponent(jobId)}${suffix}`

export const createJob = async <TInput, TOptions = Record<string, unknown>>(
  request: CreateJobRequest<TInput, TOptions>,
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<Job> => (await client.post<ApiResponse<Job>>('/api/v1/jobs', request, options)).data

export const getJob = async (
  jobId: string,
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<Job> => (await client.get<ApiResponse<Job>>(jobPath(jobId), options)).data

export const cancelJob = async (
  jobId: string,
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<Job> => (await client.delete<ApiResponse<Job>>(jobPath(jobId), options)).data

export const getJobResult = async <T>(
  jobId: string,
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<JobResult<T>> => (await client.get<ApiResponse<JobResult<T>>>(jobPath(jobId, '/result'), options)).data
