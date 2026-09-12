import { getStoredEntitlementToken } from '../storage/entitlement'
import type { ApiErrorPayload } from './types'

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
export const API_BASE_URL = (
  configuredApiBaseUrl || (import.meta.env.DEV ? 'http://localhost:8000' : '')
).replace(/\/+$/, '')
export const DEFAULT_API_TIMEOUT_MS = 30_000

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string
  readonly details?: unknown

  constructor(message: string, options: {
    status: number
    code?: string
    requestId?: string
    details?: unknown
    cause?: unknown
  }) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code ?? 'API_ERROR'
    if (options.requestId !== undefined) this.requestId = options.requestId
    if (options.details !== undefined) this.details = options.details
  }
}

export interface ApiClientConfig {
  baseUrl?: string
  timeoutMs?: number
  credentials?: RequestCredentials
  headers?: () => HeadersInit
}

export const licenseHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {}
  const token = getStoredEntitlementToken()
  if (token) headers['X-Entitlement-Token'] = token
  if (typeof document !== 'undefined') {
    const csrf = document.cookie.split('; ').find((item) => item.startsWith('kits_admin_csrf='))?.split('=')[1]
    if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf)
  }
  return headers
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'signal'> {
  body?: BodyInit | null
  json?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

export interface ApiClient {
  request<T>(path: string, options?: ApiRequestOptions): Promise<T>
  get<T>(path: string, options?: ApiRequestOptions): Promise<T>
  post<T>(path: string, json?: unknown, options?: ApiRequestOptions): Promise<T>
  delete<T>(path: string, options?: ApiRequestOptions): Promise<T>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parsePayload = (text: string): unknown => {
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const errorPayload = (value: unknown): ApiErrorPayload => {
  if (!isRecord(value)) return {}
  const nested = isRecord(value.error) ? value.error : value
  return {
    ...(typeof nested.code === 'string' ? { code: nested.code } : {}),
    ...(typeof nested.message === 'string' ? { message: nested.message } : {}),
    ...(typeof nested.detail === 'string' ? { detail: nested.detail } : {}),
    ...(typeof nested.requestId === 'string' ? { requestId: nested.requestId } : {}),
    ...('details' in nested ? { details: nested.details } : {}),
  }
}

const urlFor = (baseUrl: string, path: string) => {
  if (/^https?:\/\//i.test(path) || path.startsWith('blob:')) return path
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export const resolveApiUrl = (path: string) => urlFor(API_BASE_URL, path)

export const createApiClient = (config: ApiClientConfig = {}): ApiClient => {
  const baseUrl = (config.baseUrl ?? API_BASE_URL).replace(/\/+$/, '')
  const defaultTimeout = config.timeoutMs ?? DEFAULT_API_TIMEOUT_MS
  const credentials = config.credentials ?? 'same-origin'
  const extraHeaders = config.headers

  const request = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
    const { body, json, signal, timeoutMs: requestTimeoutMs, ...requestInit } = options
    if (body !== undefined && json !== undefined) {
      throw new TypeError('Use either body or json, not both.')
    }

    const controller = new AbortController()
    const timeoutMs = requestTimeoutMs ?? defaultTimeout
    const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out.', 'TimeoutError')), timeoutMs)
    const abort = () => controller.abort(signal?.reason)
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })

    const headers = new Headers(extraHeaders?.())
    new Headers(requestInit.headers).forEach((value, key) => headers.set(key, value))
    if (json !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json')

    try {
      const response = await fetch(urlFor(baseUrl, path), {
        ...requestInit,
        headers,
        credentials: requestInit.credentials ?? credentials,
        ...(json !== undefined ? { body: JSON.stringify(json) } : body !== undefined ? { body } : {}),
        signal: controller.signal,
      })
      const text = await response.text()
      const payload = parsePayload(text)

      if (!response.ok) {
        const apiError = errorPayload(payload)
        const requestId = apiError.requestId ?? response.headers.get('x-request-id') ?? undefined
        throw new ApiError(apiError.message ?? apiError.detail ?? (response.statusText || 'Request failed.'), {
          status: response.status,
          ...(apiError.code === undefined ? {} : { code: apiError.code }),
          ...(requestId === undefined ? {} : { requestId }),
          ...(apiError.details === undefined ? {} : { details: apiError.details }),
        })
      }

      if (text && typeof payload === 'string') {
        throw new ApiError('The server returned an invalid JSON response.', {
          status: response.status,
          code: 'INVALID_RESPONSE',
        })
      }
      return payload as T
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (controller.signal.aborted && !signal?.aborted) {
        throw new ApiError('Request timed out.', { status: 0, code: 'TIMEOUT', cause: error })
      }
      throw error
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, json, options) => request(path, { ...options, method: 'POST', json }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  }
}

export const apiClient = createApiClient({ headers: licenseHeaders })
