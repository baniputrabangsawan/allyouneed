import { PRODUCTION_API_ORIGIN } from '@/lib/api/public-origin'
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/features/seo/site'
import { DISCOVERY_PATHS } from './paths'
import { sha256Hex } from './sha256'
import { USE_KITS_SKILL_DESCRIPTION, USE_KITS_SKILL_MD, USE_KITS_SKILL_NAME } from './skill'

const DOMAIN = new URL(SITE_URL).hostname
const API_ORIGIN = PRODUCTION_API_ORIGIN
const ISSUER = SITE_URL

export const DISCOVERY_CACHE_CONTROL = 'public, max-age=3600'

export const DISCOVERY_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
} as const

export function corsOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      ...DISCOVERY_CORS,
      'Access-Control-Max-Age': '86400',
    },
  })
}

export function jsonResponse(body: unknown, contentType: string, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': DISCOVERY_CACHE_CONTROL,
      ...DISCOVERY_CORS,
      ...extra,
    },
  })
}

export function textResponse(body: string, contentType: string, extra: HeadersInit = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': DISCOVERY_CACHE_CONTROL,
      ...DISCOVERY_CORS,
      ...extra,
    },
  })
}

export function homepageLinkHeader() {
  return [
    `<${DISCOVERY_PATHS.apiCatalog}>; rel="api-catalog"`,
    `<${DISCOVERY_PATHS.openapi}>; rel="service-desc"; type="application/json"`,
    `</docs>; rel="service-doc"; type="text/html"`,
    `<${DISCOVERY_PATHS.aiCatalog}>; rel="describedby"; type="application/json"`,
  ].join(', ')
}

export function apiCatalogDocument() {
  return {
    linkset: [
      {
        anchor: `${API_ORIGIN}/`,
        'service-desc': [
          { href: absoluteUrl(DISCOVERY_PATHS.openapi), type: 'application/json' },
        ],
        'service-doc': [
          { href: absoluteUrl('/docs'), type: 'text/html' },
        ],
        status: [
          { href: `${API_ORIGIN}/api/v1/health/live` },
        ],
      },
    ],
  }
}

export function aiCatalogDocument() {
  return {
    specVersion: '1.0',
    host: {
      displayName: SITE_NAME,
      identifier: `did:web:${DOMAIN}`,
    },
    entries: [
      {
        identifier: `urn:air:${DOMAIN}:api:kits`,
        displayName: 'Kits processing API',
        type: 'application/vnd.oai.openapi+json',
        url: absoluteUrl(DISCOVERY_PATHS.openapi),
        representativeQueries: [
          'compress an image without signing in',
          'merge PDF files online',
          'generate a QR code in the browser',
          'transcribe audio with Kits speech-to-text',
        ],
      },
      {
        identifier: `urn:air:${DOMAIN}:mcp:kits`,
        displayName: 'Kits MCP server card',
        type: 'application/mcp-server-card+json',
        url: absoluteUrl(DISCOVERY_PATHS.mcpCard),
        representativeQueries: [
          'find a Kits tool for converting PNG to JPG',
          'how do I activate a Pro license on Kits',
        ],
      },
      {
        identifier: `urn:air:${DOMAIN}:skill:use-kits`,
        displayName: 'Use Kits skill',
        type: 'text/markdown',
        url: absoluteUrl(DISCOVERY_PATHS.skill),
        representativeQueries: [
          'use Kits to resize a photo in the browser',
          'where is the Kits API health endpoint',
        ],
      },
    ],
  }
}

export function mcpServerCardDocument() {
  return {
    serverInfo: {
      name: 'kits',
      version: '1.0.0',
      title: SITE_NAME,
      websiteUrl: SITE_URL,
    },
    description:
      'Discovery card for Kits. Browser tools run in the page via WebMCP; server jobs use the Kits API.',
    endpoint: absoluteUrl('/mcp'),
    transport: {
      type: 'streamable-http',
      endpoint: absoluteUrl('/mcp'),
    },
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
}

export function skillDigest() {
  return `sha256:${sha256Hex(USE_KITS_SKILL_MD)}`
}

export function agentSkillsIndexDocument() {
  return {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: USE_KITS_SKILL_NAME,
        type: 'skill-md',
        description: USE_KITS_SKILL_DESCRIPTION,
        url: absoluteUrl(DISCOVERY_PATHS.skill),
        digest: skillDigest(),
      },
    ],
  }
}

export function oauthProtectedResourceDocument() {
  return {
    resource: API_ORIGIN,
    authorization_servers: [ISSUER],
    scopes_supported: ['kits.pro'],
    bearer_methods_supported: ['header'],
    resource_documentation: absoluteUrl('/docs'),
    resource_name: `${SITE_NAME} API`,
  }
}

export function oauthAuthorizationServerDocument() {
  return {
    issuer: ISSUER,
    authorization_endpoint: absoluteUrl('/license'),
    token_endpoint: `${API_ORIGIN}/api/v1/licenses/activate`,
    jwks_uri: absoluteUrl(DISCOVERY_PATHS.jwks),
    grant_types_supported: ['urn:ietf:params:oauth:grant-type:token-exchange'],
    response_types_supported: ['token'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['kits.pro'],
    revocation_endpoint: `${API_ORIGIN}/api/v1/licenses/deactivate`,
    agent_auth: {
      skill: 'license-key',
      register_uri: absoluteUrl('/license'),
      identity_types_supported: ['anonymous'],
      anonymous: {
        credential_types_supported: ['license_key'],
        claim_uri: `${API_ORIGIN}/api/v1/licenses/status`,
      },
      registration_methods: [
        {
          type: 'license_key',
          description:
            'Paste a Kits Pro license key in the browser at /license. Duration starts on first activation. One key is one active installation.',
        },
      ],
    },
  }
}

export function jwksDocument() {
  return { keys: [] as const }
}

export function authMarkdown() {
  return `# auth.md

Kits does not run OAuth sign-in or agent account registration.

## Audience

Human users and agents that need labeled server tools (AI background removal, speech, some PDF/media jobs).

## How credentials are issued

There is no self-serve signup. An admin issues a Pro license key after a manual purchase. Plans: \`pro_1_month\`, \`pro_6_months\`, \`pro_12_months\`.

## How to enroll

1. Open ${absoluteUrl('/license')}
2. Paste the key in this browser
3. The page POSTs \`licenseKey\`, \`installationId\`, and \`deviceSecret\` to ${API_ORIGIN}/api/v1/licenses/activate
4. Store the returned entitlement token and send it as \`X-Entitlement-Token\` on later API calls

One license is one active installation. Deactivate before moving the key.

## Discovery documents

- Protected resource: ${absoluteUrl(DISCOVERY_PATHS.oauthResource)}
- Authorization server: ${absoluteUrl(DISCOVERY_PATHS.oauthAuthorizationServer)}

Do not POST enrollment during a passive scan. Discovery files are the source of truth.
`
}

export function openApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: `${SITE_NAME} API`,
      version: '0.1.0',
      description:
        'Server processing, uploads, jobs, and Pro license activation for Kits. Browser-local tools do not use this API.',
    },
    servers: [{ url: API_ORIGIN }],
    paths: {
      '/api/v1/health/live': {
        get: {
          summary: 'Liveness',
          operationId: 'healthLive',
          responses: { '200': { description: 'API process is up' } },
        },
      },
      '/api/v1/health/ready': {
        get: {
          summary: 'Readiness',
          operationId: 'healthReady',
          responses: {
            '200': { description: 'Storage and database are ready' },
            '503': { description: 'A dependency is unavailable' },
          },
        },
      },
      '/api/v1/licenses/activate': {
        post: {
          summary: 'Activate a Pro license key on this installation',
          operationId: 'activateLicense',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['licenseKey', 'installationId', 'deviceSecret'],
                  properties: {
                    licenseKey: { type: 'string' },
                    installationId: { type: 'string' },
                    deviceSecret: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Entitlement payload with token' } },
        },
      },
      '/api/v1/licenses/status': {
        get: {
          summary: 'Current license status',
          operationId: 'licenseStatus',
          parameters: [
            {
              name: 'X-Entitlement-Token',
              in: 'header',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'License status' } },
        },
      },
      '/api/v1/licenses/deactivate': {
        post: {
          summary: 'Deactivate this installation',
          operationId: 'deactivateLicense',
          parameters: [
            {
              name: 'X-Entitlement-Token',
              in: 'header',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'License status after deactivation' } },
        },
      },
      '/api/v1/uploads/presign': {
        post: {
          summary: 'Presign an upload for a server tool',
          operationId: 'presignUpload',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['filename', 'contentType', 'size', 'toolId'],
                  properties: {
                    filename: { type: 'string' },
                    contentType: { type: 'string' },
                    size: { type: 'integer' },
                    toolId: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Upload URL and file key' } },
        },
      },
      '/api/v1/jobs': {
        post: {
          summary: 'Create a processing job',
          operationId: 'createJob',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['toolId', 'input'],
                  properties: {
                    toolId: { type: 'string' },
                    input: { type: 'object' },
                    options: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: { '202': { description: 'Job accepted' } },
        },
      },
      '/api/v1/jobs/{jobId}': {
        get: {
          summary: 'Get job status',
          operationId: 'getJob',
          parameters: [
            { name: 'jobId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Job' } },
        },
      },
      '/api/v1/tts/capabilities': {
        get: {
          summary: 'List text-to-speech voices',
          operationId: 'ttsCapabilities',
          responses: { '200': { description: 'Voices and languages' } },
        },
      },
    },
  }
}

export function discoveryResponse(pathname: string): Response | undefined {
  switch (pathname) {
    case DISCOVERY_PATHS.apiCatalog:
      return jsonResponse(apiCatalogDocument(), 'application/linkset+json')
    case DISCOVERY_PATHS.aiCatalog:
      return jsonResponse(aiCatalogDocument(), 'application/json')
    case DISCOVERY_PATHS.mcpCard:
      return jsonResponse(mcpServerCardDocument(), 'application/mcp-server-card+json')
    case DISCOVERY_PATHS.skillsIndex:
      return jsonResponse(agentSkillsIndexDocument(), 'application/json')
    case DISCOVERY_PATHS.skill:
      return textResponse(USE_KITS_SKILL_MD, 'text/markdown; charset=utf-8')
    case DISCOVERY_PATHS.oauthResource:
      return jsonResponse(oauthProtectedResourceDocument(), 'application/json')
    case DISCOVERY_PATHS.oauthAuthorizationServer:
    case DISCOVERY_PATHS.openIdConfiguration:
      return jsonResponse(oauthAuthorizationServerDocument(), 'application/json')
    case DISCOVERY_PATHS.jwks:
      return jsonResponse(jwksDocument(), 'application/json')
    case DISCOVERY_PATHS.authMd:
      return textResponse(authMarkdown(), 'text/markdown; charset=utf-8')
    case DISCOVERY_PATHS.openapi:
      return jsonResponse(openApiDocument(), 'application/json')
    default:
      return undefined
  }
}
