import { apiClient, type ApiClient, type ApiRequestOptions } from './client'
import type { LicensePlan, LicenseStatus } from './licenses'
import type { ApiResponse } from './types'

export type DurationMonths = 1 | 6 | 12
export type AdminDisplayStatus = LicenseStatus | 'unused'

export interface AdminIdentity {
  adminId: string
  email: string
  identityProvider: string
  logoutUrl: string
}

export interface AdminLicense {
  licenseId: string
  plan: LicensePlan
  status: LicenseStatus
  expiresAt: string | null
  activatedAt: string | null
  keyPrefix: string | null
  maxActivations: number
  installationActive: boolean
  createdAt: string
  updatedAt: string
  note: string | null
}

export interface IssuedAdminLicense extends AdminLicense { licenseKey: string }
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number; pages: number }
export interface AdminOverview { active: number; unused: number; expiringSoon: number; revoked: number; createdThisMonth: number }
export interface AdminAudit { id: string; adminEmail: string; action: string; targetLicenseId: string; requestId: string; at: string; meta: Record<string, string> | null }
export interface AdminSystemHealth { api: string; database: string; redis: string; workers: string; storage: string }

export interface LicenseListParams { page?: number; pageSize?: number; status?: AdminDisplayStatus; search?: string }
const query = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) })
  const result = params.toString()
  return result ? `?${result}` : ''
}
const licensePath = (id: string, action = '') => `/api/v1/admin/licenses/${encodeURIComponent(id)}${action}`

export const getAdminIdentity = async (options?: ApiRequestOptions, client: ApiClient = apiClient) =>
  (await client.get<ApiResponse<AdminIdentity>>('/api/v1/admin/licenses/me', options)).data
export const getAdminOverview = async (options?: ApiRequestOptions, client: ApiClient = apiClient) =>
  (await client.get<ApiResponse<AdminOverview>>('/api/v1/admin/licenses/overview/metrics', options)).data
export const listAdminLicenses = async (params: LicenseListParams = {}, options?: ApiRequestOptions, client: ApiClient = apiClient) =>
  (await client.get<ApiResponse<Page<AdminLicense>>>(`/api/v1/admin/licenses${query({ page: params.page, page_size: params.pageSize, status: params.status, search: params.search })}`, options)).data
export const createAdminLicense = async (durationMonths: DurationMonths, note?: string, options?: ApiRequestOptions, client: ApiClient = apiClient) =>
  (await client.post<ApiResponse<IssuedAdminLicense>>('/api/v1/admin/licenses', { durationMonths, note: note || undefined }, options)).data
export const mutateAdminLicense = async (id: string, action: 'renew' | 'suspend' | 'resume' | 'revoke' | 'reset-activations', durationMonths?: DurationMonths, options?: ApiRequestOptions, client: ApiClient = apiClient) =>
  (await client.post<ApiResponse<AdminLicense>>(licensePath(id, `/${action}`), action === 'renew' ? { durationMonths } : undefined, options)).data
export const listAdminAudit = async (page = 1, options?: ApiRequestOptions, client: ApiClient = apiClient) =>
  (await client.get<ApiResponse<Page<AdminAudit>>>(`/api/v1/admin/audit?page=${page}`, options)).data
export const getAdminSystemHealth = async (options?: ApiRequestOptions, client: ApiClient = apiClient) =>
  (await client.get<ApiResponse<AdminSystemHealth>>('/api/v1/admin/system/health', options)).data
