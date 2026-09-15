export const DISCOVERY_PATHS = {
  apiCatalog: '/.well-known/api-catalog',
  aiCatalog: '/.well-known/ai-catalog.json',
  mcpCard: '/.well-known/mcp/server-card.json',
  skillsIndex: '/.well-known/agent-skills/index.json',
  skill: '/.well-known/agent-skills/use-kits/SKILL.md',
  oauthResource: '/.well-known/oauth-protected-resource',
  oauthAuthorizationServer: '/.well-known/oauth-authorization-server',
  openIdConfiguration: '/.well-known/openid-configuration',
  jwks: '/.well-known/jwks.json',
  authMd: '/auth.md',
  openapi: '/openapi.json',
} as const

export function normalizePathname(pathname: string) {
  const path = pathname.split('?')[0] ?? '/'
  if (path.length > 1 && path.endsWith('/')) return path.replace(/\/+$/, '') || '/'
  return path || '/'
}

export function isHomePath(pathname: string) {
  const path = normalizePathname(pathname)
  return path === '/' || path === '/id'
}

const DISCOVERY_SET = new Set<string>(Object.values(DISCOVERY_PATHS))

export function isDiscoveryPath(pathname: string) {
  return DISCOVERY_SET.has(normalizePathname(pathname))
}
