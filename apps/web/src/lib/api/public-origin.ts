export const PRODUCTION_API_ORIGIN = 'https://api.usekits.online'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

export function isLocalApiHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return LOCAL_HOSTS.has(host) || host.endsWith('.localhost')
}

export function resolveApiBaseUrl(raw: string | undefined, mode: 'dev' | 'prod'): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '')
  if (value) return value
  return mode === 'dev' ? 'http://localhost:8000' : PRODUCTION_API_ORIGIN
}

export function assertProductionApiBaseUrl(raw: string | undefined, command: string): void {
  if (command !== 'build') return
  const value = (raw ?? '').trim()
  if (!value) return
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`VITE_API_BASE_URL is not a valid URL: ${value}`)
  }
  if (isLocalApiHost(url.hostname)) {
    throw new Error('VITE_API_BASE_URL cannot be a localhost address in a production build.')
  }
  if (url.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL must use HTTPS in a production build.')
  }
}
