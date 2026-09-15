import { createMiddleware, createStart } from "@tanstack/react-start";
import { agentDiscoveryResponse, applyAgentHeaders } from "@/features/agents/headers";
import { resolveApiOrigin } from "@/lib/api/public-origin";
import {
  isPosthogProxyPath,
  proxyPosthogRequest,
} from "@/lib/posthog-proxy";
import { contentSecurityPolicy } from "@/lib/security-policy";

const production = import.meta.env.PROD;
const apiOrigin = resolveApiOrigin(
  import.meta.env.VITE_API_BASE_URL,
  production ? "prod" : "dev",
);
const policy = contentSecurityPolicy({
  production,
  apiOrigin,
});

function withSecurityHeaders(response: Response, pathname: string) {
  const secured = new Headers(response.headers);
  secured.set("Content-Security-Policy", policy);
  if (production) {
    secured.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  secured.set("X-Content-Type-Options", "nosniff");
  secured.set("X-Frame-Options", "DENY");
  secured.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), payment=()",
  );
  secured.set("Cross-Origin-Opener-Policy", "same-origin");
  secured.set("Cross-Origin-Resource-Policy", "same-origin");
  return applyAgentHeaders(
    pathname,
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: secured,
    }),
  );
}

const securityHeaders = createMiddleware().server(async ({ next, request, pathname, context }) => {
  if (isPosthogProxyPath(pathname)) {
    return {
      request,
      pathname,
      context,
      response: await proxyPosthogRequest(request),
    };
  }
  const early = agentDiscoveryResponse(request, pathname);
  if (early) {
    return {
      request,
      pathname,
      context,
      response: withSecurityHeaders(early, pathname),
    };
  }
  const result = await next();
  if (!result.response) return result;
  return { ...result, response: withSecurityHeaders(result.response, pathname) };
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}));
