import { createMiddleware, createStart } from "@tanstack/react-start";
import { resolveApiOrigin } from "@/lib/api/public-origin";

const production = import.meta.env.PROD;
const apiOrigin = resolveApiOrigin(
  import.meta.env.VITE_API_BASE_URL,
  production ? "prod" : "dev",
);
const connectSources = production
  ? `'self' ${apiOrigin} https://cloudflareinsights.com`
  : `'self' ${apiOrigin} ws://localhost:* ws://127.0.0.1:*`;
const scriptSources = production
  ? "'self' 'unsafe-inline' https://static.cloudflareinsights.com"
  : "'self' 'unsafe-inline'";
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
].join("; ");

function withSecurityHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", contentSecurityPolicy);
  if (production) {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), payment=()",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next();
  if (!result.response) return result;
  return { ...result, response: withSecurityHeaders(result.response) };
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}));
