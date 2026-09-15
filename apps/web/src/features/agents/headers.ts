import {
  corsOptionsResponse,
  DISCOVERY_CACHE_CONTROL,
  discoveryResponse,
  homepageLinkHeader,
} from './documents'
import { markdownForPath, markdownTokenCount, wantsMarkdown } from './markdown'
import { isDiscoveryPath, isHomePath, normalizePathname } from './paths'

export function applyAgentHeaders(pathname: string, response: Response) {
  const headers = new Headers(response.headers)
  if (isHomePath(pathname)) {
    headers.append('Link', homepageLinkHeader())
  }
  const contentType = headers.get('Content-Type') ?? ''
  if (isDiscoveryPath(pathname) || isHomePath(pathname) || contentType.includes('text/markdown') || contentType.includes('linkset')) {
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function markdownResponse(pathname: string, accept: string | null) {
  if (!wantsMarkdown(accept)) return undefined
  const markdown = markdownForPath(pathname)
  if (!markdown) return undefined
  return new Response(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': DISCOVERY_CACHE_CONTROL,
      'Access-Control-Allow-Origin': '*',
      'x-markdown-tokens': String(markdownTokenCount(markdown)),
      Vary: 'Accept',
    },
  })
}

export function agentDiscoveryResponse(request: Request, pathname: string) {
  const path = normalizePathname(pathname)
  if (isDiscoveryPath(path)) {
    if (request.method === 'OPTIONS') return corsOptionsResponse()
    if (request.method === 'GET' || request.method === 'HEAD') {
      const response = discoveryResponse(path)
      if (!response) return undefined
      if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers: response.headers })
      }
      return response
    }
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    const markdown = markdownResponse(path, request.headers.get('accept'))
    if (!markdown) return undefined
    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers: markdown.headers })
    }
    return markdown
  }
  return undefined
}

export function discoveryHandlers(path: string) {
  return {
    GET: ({ request }: { request: Request }) =>
      agentDiscoveryResponse(request, path) ?? new Response('Not Found', { status: 404 }),
    OPTIONS: () => corsOptionsResponse(),
  }
}

export function htmlOrMarkdown<T>({
  request,
  next,
  pathname,
}: {
  request: Request
  next: () => T
  pathname: string
}): Response | T {
  const markdown = markdownResponse(pathname, request.headers.get('accept'))
  if (markdown) return markdown
  return next()
}
