import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { ApiError } from '@/lib/api/client'
import { getLicenseStatus } from '@/lib/api/licenses'
import {
  ENTITLEMENT_STORAGE_EVENT,
  clearEntitlement,
  getStoredEntitlementCache,
  getStoredEntitlementToken,
  type EntitlementCache,
} from '@/lib/storage/entitlement'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import type { Entitlement, LicenseStatusView } from './types'
import { entitlementQueryKeys } from './query-keys'

export type EntitlementState = 'loading' | 'free' | 'pro'

const FATAL_CODES = new Set([
  'LICENSE_EXPIRED',
  'LICENSE_REVOKED',
  'LICENSE_SUSPENDED',
  'ACTIVATION_REVOKED',
  'ENTITLEMENT_INVALID',
  'ENTITLEMENT_EXPIRED',
])

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(ENTITLEMENT_STORAGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(ENTITLEMENT_STORAGE_EVENT, callback)
  }
}

function tokenSnapshot() {
  return getStoredEntitlementToken() ?? ''
}

export function useClientHydrated() {
  return useSyncExternalStore(() => () => undefined, () => true, () => false)
}

export function useStoredEntitlementToken() {
  return useSyncExternalStore(subscribe, tokenSnapshot, () => '')
}

export function resolveEntitlementState(input: {
  hydrated: boolean
  hasToken: boolean
  active: boolean
  settled: boolean
}): EntitlementState {
  if (!input.hydrated) return 'loading'
  if (input.active) return 'pro'
  if (!input.hasToken) return 'free'
  if (!input.settled) return 'loading'
  return 'free'
}

export function useEntitlement() {
  const hydrated = useClientHydrated()
  const token = useStoredEntitlementToken()
  const cached = hydrated ? getStoredEntitlementCache() : undefined
  const query = useQuery({
    queryKey: entitlementQueryKeys.status(token),
    queryFn: async () => {
      try {
        return await getLicenseStatus()
      } catch (reason) {
        if (reason instanceof ApiError && FATAL_CODES.has(reason.code)) {
          clearEntitlement()
        }
        throw reason
      }
    },
    enabled: hydrated && token.length > 0,
    staleTime: 30_000,
    retry: false,
    ...(cached ? { placeholderData: cacheToStatus(cached) } : {}),
  })
  const state = resolveEntitlementState({
    hydrated,
    hasToken: token.length > 0,
    active: isPro(query.data),
    settled: query.isSuccess || query.isError,
  })
  return { ...query, state }
}

export function isPro(status: Entitlement | undefined) {
  return status?.status === 'active'
}

export function hasCapability(
  status: Entitlement | undefined,
  capability: string | undefined,
) {
  if (!capability) return isPro(status)
  return Boolean(isPro(status) && status?.capabilities.includes(capability))
}

export function canUseTool(tool: ToolDefinition, entitlement: Entitlement | undefined): boolean {
  if (!tool.requiresPro) return true
  return hasCapability(entitlement, tool.requiredCapability)
}

function cacheToStatus(cache: EntitlementCache): LicenseStatusView {
  return {
    plan: cache.plan,
    status: cache.status,
    expiresAt: cache.expiresAt,
    capabilities: cache.capabilities,
    installationActive: cache.status === 'active',
  }
}
