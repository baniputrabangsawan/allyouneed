import { createMiddleware, createStart } from '@tanstack/react-start'
import { PRODUCTION_API_ORIGIN } from '@/lib/api/public-origin'

const production = import.meta.env.PROD
const connectSources = production
  ? `'self' ${PRODUCTION_API_ORIGIN} https://cloudflareinsights.com`
  : "'self' http://localhost:8000 http://127.0.0.1:8000 ws://localhost:* ws://127.0.0.1:*"
const scriptSources = production
  ? "'self' 'unsafe-inline' https://static.cloudflareinsights.com"
  : "'self' 'unsafe-inline'"
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src ${scriptSources}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  `connect-src ${connectSources}`,
  "worker-src 'self' blob:",
  ...(production ? ["upgrade-insecure-requests"] : []),
].join('; ')

const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next()
  result.response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  if (production) {
    result.response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  result.response.headers.set('X-Content-Type-Options', 'nosniff')
  result.response.headers.set('X-Frame-Options', 'DENY')
  result.response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  result.response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()')
  result.response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  result.response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  return result
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}))
