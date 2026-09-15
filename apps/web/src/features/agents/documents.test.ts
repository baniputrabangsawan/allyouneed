import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { SITE_URL } from '@/features/seo/site'
import { PRODUCTION_API_ORIGIN } from '@/lib/api/public-origin'
import {
  agentSkillsIndexDocument,
  aiCatalogDocument,
  apiCatalogDocument,
  authMarkdown,
  discoveryResponse,
  homepageLinkHeader,
  mcpServerCardDocument,
  oauthAuthorizationServerDocument,
  oauthProtectedResourceDocument,
  openApiDocument,
  skillDigest,
} from './documents'
import { agentDiscoveryResponse, applyAgentHeaders, markdownResponse } from './headers'
import { wantsMarkdown } from './markdown'
import { DISCOVERY_PATHS } from './paths'
import { sha256Hex } from './sha256'
import { USE_KITS_SKILL_MD } from './skill'

const origin = 'https://usekits.online'

describe('sha256', () => {
  it('matches Node crypto for skill markdown and the empty string', () => {
    expect(sha256Hex('')).toBe(createHash('sha256').update('').digest('hex'))
    expect(sha256Hex(USE_KITS_SKILL_MD)).toBe(createHash('sha256').update(USE_KITS_SKILL_MD).digest('hex'))
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('RFC 9727 API catalog', () => {
  it('is a linkset with service-desc, service-doc, and status', () => {
    const catalog = apiCatalogDocument()
    expect(catalog.linkset).toHaveLength(1)
    const entry = catalog.linkset[0]!
    expect(entry.anchor).toBe(`${PRODUCTION_API_ORIGIN}/`)
    expect(entry['service-desc'][0]?.href).toBe(`${origin}/openapi.json`)
    expect(entry['service-doc'][0]?.href).toBe(`${origin}/docs`)
    expect(entry.status[0]?.href).toBe(`${PRODUCTION_API_ORIGIN}/api/v1/health/live`)
  })
})

describe('ARD catalog', () => {
  it('has specVersion, host, URNs, urls, and representative queries', () => {
    const catalog = aiCatalogDocument()
    expect(catalog.specVersion).toBe('1.0')
    expect(catalog.host.displayName).toBe('Kits')
    expect(catalog.entries.length).toBeGreaterThan(0)
    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(/^urn:air:usekits\.online:[a-z]+:[a-z0-9-]+$/)
      expect(entry.url).toMatch(/^https:\/\//)
      expect('data' in entry).toBe(false)
      expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2)
      expect(entry.representativeQueries.length).toBeLessThanOrEqual(5)
    }
  })
})

describe('MCP server card', () => {
  it('names the server and a transport endpoint', () => {
    const card = mcpServerCardDocument()
    expect(card.serverInfo.name).toBe('kits')
    expect(card.transport.endpoint).toBe(`${origin}/mcp`)
    expect(card.capabilities.tools).toEqual({})
  })
})

describe('agent skills index', () => {
  it('uses schema 0.2.0 and a sha256 digest of SKILL.md', () => {
    const index = agentSkillsIndexDocument()
    expect(index.$schema).toBe('https://schemas.agentskills.io/discovery/0.2.0/schema.json')
    const skill = index.skills[0]!
    expect(skill.name).toBe('use-kits')
    expect(skill.type).toBe('skill-md')
    expect(skill.url).toBe(`${origin}/.well-known/agent-skills/use-kits/SKILL.md`)
    expect(skill.digest).toBe(skillDigest())
    expect(skill.digest).toMatch(/^sha256:[a-f0-9]{64}$/)
  })
})

describe('OAuth discovery', () => {
  it('points protected resource metadata at the API origin', () => {
    const prm = oauthProtectedResourceDocument()
    expect(prm.resource).toBe(PRODUCTION_API_ORIGIN)
    expect(prm.authorization_servers).toEqual([SITE_URL])
  })

  it('describes license-key activation instead of a fake IdP', () => {
    const as = oauthAuthorizationServerDocument()
    expect(as.issuer).toBe(SITE_URL)
    expect(as.token_endpoint).toBe(`${PRODUCTION_API_ORIGIN}/api/v1/licenses/activate`)
    expect(as.agent_auth.skill).toBe('license-key')
    expect(authMarkdown()).toContain('/license')
    expect(authMarkdown()).not.toMatch(/sign in with google/i)
  })
})

describe('OpenAPI', () => {
  it('lists public health and license paths on the API origin', () => {
    const spec = openApiDocument()
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.servers[0]?.url).toBe(PRODUCTION_API_ORIGIN)
    expect(spec.paths['/api/v1/health/live']).toBeTruthy()
    expect(spec.paths['/api/v1/licenses/activate']).toBeTruthy()
  })
})

describe('discovery responses', () => {
  it('serves every well-known path with CORS', async () => {
    const expected: Record<string, string> = {
      [DISCOVERY_PATHS.apiCatalog]: 'application/linkset+json',
      [DISCOVERY_PATHS.aiCatalog]: 'application/json',
      [DISCOVERY_PATHS.mcpCard]: 'application/mcp-server-card+json',
      [DISCOVERY_PATHS.skillsIndex]: 'application/json',
      [DISCOVERY_PATHS.skill]: 'text/markdown; charset=utf-8',
      [DISCOVERY_PATHS.oauthResource]: 'application/json',
      [DISCOVERY_PATHS.oauthAuthorizationServer]: 'application/json',
      [DISCOVERY_PATHS.openIdConfiguration]: 'application/json',
      [DISCOVERY_PATHS.jwks]: 'application/json',
      [DISCOVERY_PATHS.authMd]: 'text/markdown; charset=utf-8',
      [DISCOVERY_PATHS.openapi]: 'application/json',
    }
    for (const [path, type] of Object.entries(expected)) {
      const response = discoveryResponse(path)
      expect(response, path).toBeTruthy()
      expect(response!.headers.get('Content-Type')).toBe(type)
      expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response!.status).toBe(200)
    }
  })

  it('intercepts GET discovery before the HTML router', async () => {
    const response = agentDiscoveryResponse(
      new Request('https://usekits.online/.well-known/api-catalog', { method: 'GET' }),
      '/.well-known/api-catalog',
    )
    expect(response?.status).toBe(200)
    expect(response?.headers.get('Content-Type')).toBe('application/linkset+json')
    const body = await response!.json() as { linkset: unknown[] }
    expect(body.linkset).toHaveLength(1)
  })
})

describe('RFC 8288 Link headers', () => {
  it('advertises catalog, service-desc, service-doc, and describedby on the homepage', () => {
    const link = homepageLinkHeader()
    expect(link).toContain('</.well-known/api-catalog>; rel="api-catalog"')
    expect(link).toContain(`rel="service-desc"`)
    expect(link).toContain(`rel="service-doc"`)
    expect(link).toContain(`rel="describedby"`)
    const headed = applyAgentHeaders('/', new Response('ok'))
    expect(headed.headers.get('Link')).toBe(link)
    expect(headed.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(headed.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin')
  })
})

describe('markdown negotiation', () => {
  it('prefers markdown when Accept ranks it at least as high as HTML', () => {
    expect(wantsMarkdown('text/markdown')).toBe(true)
    expect(wantsMarkdown('text/markdown, text/html')).toBe(true)
    expect(wantsMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')).toBe(false)
    expect(wantsMarkdown('text/html, text/markdown;q=0.8')).toBe(false)
    expect(wantsMarkdown(null)).toBe(false)
  })

  it('returns homepage markdown with a token count header', async () => {
    const response = markdownResponse('/', 'text/markdown')
    expect(response?.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(Number(response?.headers.get('x-markdown-tokens'))).toBeGreaterThan(20)
    const body = await response!.text()
    expect(body.startsWith('# Kits')).toBe(true)
    expect(body).toContain('/.well-known/api-catalog')
  })
})
