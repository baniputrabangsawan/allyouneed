import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  resolvePosthogCspOrigins,
} from "./security-policy";

describe("PostHog CSP origins", () => {
  it("adds the US assets host next to the ingestion origin", () => {
    expect(resolvePosthogCspOrigins("https://us.i.posthog.com")).toEqual([
      "https://us.i.posthog.com",
      "https://us-assets.i.posthog.com",
    ]);
  });

  it("adds the EU assets host next to the ingestion origin", () => {
    expect(resolvePosthogCspOrigins("https://eu.i.posthog.com/")).toEqual([
      "https://eu.i.posthog.com",
      "https://eu-assets.i.posthog.com",
    ]);
  });

  it("keeps a reverse-proxy host as a single origin", () => {
    expect(
      resolvePosthogCspOrigins("https://kits.example.com/ingest"),
    ).toEqual(["https://kits.example.com"]);
  });

  it("ignores missing or invalid hosts", () => {
    expect(resolvePosthogCspOrigins(undefined)).toEqual([]);
    expect(resolvePosthogCspOrigins("")).toEqual([]);
    expect(resolvePosthogCspOrigins("javascript:alert(1)")).toEqual([]);
  });
});

describe("content security policy", () => {
  it("allows PostHog scripts and API calls in development", () => {
    const policy = contentSecurityPolicy({
      production: false,
      apiOrigin: "http://localhost:8000",
      posthogHost: "https://us.i.posthog.com",
    });
    expect(policy).toContain(
      "script-src 'self' 'unsafe-inline' https://us.i.posthog.com https://us-assets.i.posthog.com",
    );
    expect(policy).toContain(
      "connect-src 'self' http://localhost:8000 ws://localhost:* ws://127.0.0.1:* https://us.i.posthog.com https://us-assets.i.posthog.com",
    );
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("omits PostHog when no host is configured", () => {
    const policy = contentSecurityPolicy({
      production: false,
      apiOrigin: "http://localhost:8000",
    });
    expect(policy).not.toContain("posthog.com");
    expect(policy).toContain(
      "connect-src 'self' http://localhost:8000 ws://localhost:* ws://127.0.0.1:*",
    );
  });

  it("keeps Cloudflare Insights and PostHog in production", () => {
    const policy = contentSecurityPolicy({
      production: true,
      apiOrigin: "https://api.usekits.online",
      posthogHost: "https://us.i.posthog.com",
    });
    expect(policy).toContain("https://static.cloudflareinsights.com");
    expect(policy).toContain("https://cloudflareinsights.com");
    expect(policy).toContain("https://us-assets.i.posthog.com");
    expect(policy).toContain("upgrade-insecure-requests");
  });
});
