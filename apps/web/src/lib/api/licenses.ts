import { apiClient, type ApiClient, type ApiRequestOptions } from './client'
import type { ApiResponse } from './types'

export type LicensePlan = 'pro_1_month' | 'pro_6_months' | 'pro_12_months'
export type LicenseStatus = 'active' | 'expired' | 'suspended' | 'revoked'

export interface EntitlementPayload {
  token: string
  plan: LicensePlan
  status: LicenseStatus
  expiresAt: string | null
  capabilities: string[]
}

export interface LicenseStatusView {
  plan: LicensePlan
  status: LicenseStatus
  expiresAt: string | null
  capabilities: string[]
  installationActive: boolean
}

export const activateLicense = async (
  licenseKey: string,
  installationId: string,
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<EntitlementPayload> =>
  (await client.post<ApiResponse<EntitlementPayload>>(
    '/api/v1/licenses/activate',
    { licenseKey, installationId },
    options,
  )).data

export const refreshLicense = async (
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<EntitlementPayload> =>
  (await client.post<ApiResponse<EntitlementPayload>>('/api/v1/licenses/refresh', undefined, options)).data

export const deactivateLicense = async (
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<LicenseStatusView> =>
  (await client.post<ApiResponse<LicenseStatusView>>('/api/v1/licenses/deactivate', undefined, options)).data

export const getLicenseStatus = async (
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<LicenseStatusView> =>
  (await client.get<ApiResponse<LicenseStatusView>>('/api/v1/licenses/status', options)).data
