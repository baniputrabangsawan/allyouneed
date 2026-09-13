export const adminQueryKeys = {
  all: ['admin'] as const,
  identity: () => [...adminQueryKeys.all, 'identity'] as const,
  overview: () => [...adminQueryKeys.all, 'overview'] as const,
  licenses: (page: number, search: string, status: string) =>
    [...adminQueryKeys.all, 'licenses', page, search, status] as const,
  audit: () => [...adminQueryKeys.all, 'audit'] as const,
  system: () => [...adminQueryKeys.all, 'system'] as const,
}
