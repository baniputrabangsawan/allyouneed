import { apiClient, type ApiClient, type ApiRequestOptions } from './client'
import type {
  ApiResponse,
  CompleteUploadRequest,
  PresignedUpload,
  PresignUploadRequest,
  UploadedFile,
} from './types'

export interface UploadFileOptions extends ApiRequestOptions {
  onProgress?: (percent: number) => void
}

export const createUpload = async (
  request: PresignUploadRequest,
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<PresignedUpload> =>
  (await client.post<ApiResponse<PresignedUpload>>('/api/v1/uploads/presign', request, options)).data

function putWithProgress(
  url: string,
  file: Blob,
  headers: Headers,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    headers.forEach((value, key) => xhr.setRequestHeader(key, value))
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error('Upload failed.'))
    xhr.onabort = () => reject(new DOMException('Upload aborted.', 'AbortError'))
    const abort = () => xhr.abort()
    if (signal?.aborted) {
      reject(new DOMException('Upload aborted.', 'AbortError'))
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
    xhr.send(file)
  })
}

export const uploadFile = async (
  upload: PresignedUpload,
  file: Blob,
  options?: UploadFileOptions,
  client: ApiClient = apiClient,
): Promise<void> => {
  const { onProgress, ...requestOptions } = options ?? {}
  const headers = new Headers(upload.headers)
  new Headers(requestOptions.headers).forEach((value, key) => headers.set(key, value))
  if (onProgress) {
    await putWithProgress(upload.uploadUrl, file, headers, onProgress, requestOptions.signal)
    return
  }
  await client.request<void>(upload.uploadUrl, {
    ...requestOptions,
    method: 'PUT',
    credentials: 'omit',
    headers,
    body: file,
  })
}

export const completeUpload = async (
  request: CompleteUploadRequest,
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<UploadedFile> =>
  (await client.post<ApiResponse<UploadedFile>>('/api/v1/uploads/complete', request, options)).data
