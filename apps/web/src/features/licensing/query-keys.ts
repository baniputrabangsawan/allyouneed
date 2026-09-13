export const entitlementQueryKeys = {
  all: ['license-status'] as const,
  status: (token: string) => [...entitlementQueryKeys.all, token] as const,
}
