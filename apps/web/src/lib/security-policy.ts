export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

export function resolvePosthogCspOrigins(
  apiHost: string | undefined,
): string[] {
  const value = (apiHost ?? "").trim();
  if (!value) return [];
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return [];
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return [];
  const origins = [url.origin];
  const region = url.hostname.match(/^([a-z]{2})\.i\.posthog\.com$/i);
  const regionCode = region?.[1];
  if (regionCode) {
    const assets = `${url.protocol}//${regionCode.toLowerCase()}-assets.i.posthog.com`;
    if (assets !== url.origin) origins.push(assets);
  }
  return origins;
}

function sources(...tokens: Array<string | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out.join(" ");
}

export function contentSecurityPolicy(options: {
  production: boolean;
  apiOrigin: string;
  posthogHost?: string;
}): string {
  const posthogOrigins = resolvePosthogCspOrigins(options.posthogHost);
  const connectSources = sources(
    "'self'",
    options.apiOrigin,
    options.production ? "https://cloudflareinsights.com" : undefined,
    options.production ? undefined : "ws://localhost:*",
    options.production ? undefined : "ws://127.0.0.1:*",
    ...posthogOrigins,
  );
  const scriptSources = sources(
    "'self'",
    "'unsafe-inline'",
    options.production ? "https://static.cloudflareinsights.com" : undefined,
    ...posthogOrigins,
  );
  return [
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
    ...(options.production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
