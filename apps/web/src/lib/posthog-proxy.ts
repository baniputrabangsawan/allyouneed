import {
  DEFAULT_POSTHOG_HOST,
  resolvePosthogCspOrigins,
} from "./security-policy";

export const POSTHOG_PROXY_PATH = "/ingest";

const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "cookie",
];

export function isPosthogProxyPath(pathname: string): boolean {
  return pathname === POSTHOG_PROXY_PATH || pathname.startsWith(`${POSTHOG_PROXY_PATH}/`);
}

export function posthogIngestOrigin(origin: string): string {
  return `${origin.replace(/\/$/, "")}${POSTHOG_PROXY_PATH}`;
}

export function posthogInitHosts(origin: string, apiHost?: string) {
  const ingest = posthogIngestOrigin(origin);
  return {
    api_host: ingest,
    asset_host: ingest,
    ui_host: posthogUiHost(apiHost),
  };
}

export function posthogUiHost(apiHost: string | undefined): string {
  const host = (apiHost ?? DEFAULT_POSTHOG_HOST).toLowerCase();
  return host.includes("eu.i.posthog.com")
    ? "https://eu.posthog.com"
    : "https://us.posthog.com";
}

export function resolvePosthogUpstreams(apiHost: string | undefined): {
  ingest: string;
  assets: string;
} {
  const origins = resolvePosthogCspOrigins(apiHost || DEFAULT_POSTHOG_HOST);
  const ingest = origins[0] ?? DEFAULT_POSTHOG_HOST;
  return { ingest, assets: origins[1] ?? ingest };
}

export function rewritePosthogProxyUrl(
  requestUrl: string,
  apiHost?: string,
): URL | undefined {
  const url = new URL(requestUrl, "http://127.0.0.1");
  if (!isPosthogProxyPath(url.pathname)) return undefined;
  const rest = url.pathname.slice(POSTHOG_PROXY_PATH.length) || "/";
  const { ingest, assets } = resolvePosthogUpstreams(apiHost);
  const target = new URL(rest.startsWith("/static/") ? assets : ingest);
  target.pathname = rest;
  target.search = url.search;
  return target;
}

function strippedHeaders(input: Headers, extra: string[] = []): Headers {
  const headers = new Headers();
  const skip = new Set(HOP_BY_HOP.concat(extra).map((name) => name.toLowerCase()));
  input.forEach((value, key) => {
    if (skip.has(key.toLowerCase())) return;
    headers.append(key, value);
  });
  return headers;
}

export async function proxyPosthogRequest(
  request: Request,
  apiHost = process.env.VITE_POSTHOG_HOST,
): Promise<Response> {
  const target = rewritePosthogProxyUrl(request.url, apiHost);
  if (!target) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("host", target.host);
  headers.set("accept", request.headers.get("accept") ?? "*/*");
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "follow",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }
  const upstream = await fetch(target, init);
  const responseHeaders = strippedHeaders(upstream.headers, ["set-cookie"]);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export function posthogViteProxy(apiHost: string | undefined) {
  const { assets } = resolvePosthogUpstreams(apiHost);
  return {
    "/ingest/static": {
      target: assets,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/ingest/, "") || "/",
    },
  };
}
