import { describe, expect, it } from "vitest";
import {
  isPosthogProxyPath,
  posthogInitHosts,
  posthogIngestOrigin,
  posthogUiHost,
  posthogViteProxy,
  rewritePosthogProxyUrl,
} from "./posthog-proxy";

describe("PostHog first-party proxy", () => {
  it("routes session-replay assets to the assets host", () => {
    const target = rewritePosthogProxyUrl(
      "http://localhost:3000/ingest/static/1.430.3/posthog-recorder.js",
      "https://us.i.posthog.com",
    );
    expect(target?.href).toBe(
      "https://us-assets.i.posthog.com/static/1.430.3/posthog-recorder.js",
    );
  });

  it("routes dead-click scripts to the assets host", () => {
    const target = rewritePosthogProxyUrl(
      "http://localhost:3000/ingest/static/1.430.3/dead-clicks-autocapture.js",
    );
    expect(target?.href).toBe(
      "https://us-assets.i.posthog.com/static/1.430.3/dead-clicks-autocapture.js",
    );
  });

  it("routes event ingestion to the API host", () => {
    expect(
      rewritePosthogProxyUrl("http://localhost:3000/ingest/i/v0/e/", "https://us.i.posthog.com")
        ?.href,
    ).toBe("https://us.i.posthog.com/i/v0/e/");
    expect(
      rewritePosthogProxyUrl("http://localhost:3000/ingest/e/?retry_count=1")?.href,
    ).toBe("https://us.i.posthog.com/e/?retry_count=1");
  });

  it("ignores non-proxy paths", () => {
    expect(isPosthogProxyPath("/tools")).toBe(false);
    expect(rewritePosthogProxyUrl("http://localhost:3000/e/")).toBeUndefined();
  });

  it("points the toolbar at the matching PostHog region", () => {
    expect(posthogUiHost("https://us.i.posthog.com")).toBe("https://us.posthog.com");
    expect(posthogUiHost("https://eu.i.posthog.com")).toBe("https://eu.posthog.com");
  });

  it("keeps api and assets on the page origin so Chrome cannot treat them as trackers", () => {
    expect(posthogIngestOrigin("http://localhost:3000/")).toBe("http://localhost:3000/ingest");
    expect(posthogInitHosts("https://usekits.online", "https://us.i.posthog.com")).toEqual({
      api_host: "https://usekits.online/ingest",
      asset_host: "https://usekits.online/ingest",
      ui_host: "https://us.posthog.com",
    });
  });

  it("configures Vite to proxy only PostHog static assets", () => {
    const proxy = posthogViteProxy("https://us.i.posthog.com");
    expect(Object.keys(proxy)).toEqual(["/ingest/static"]);
    expect(proxy["/ingest/static"].target).toBe("https://us-assets.i.posthog.com");
    expect(proxy["/ingest/static"].rewrite("/ingest/static/1.430.3/posthog-recorder.js")).toBe(
      "/static/1.430.3/posthog-recorder.js",
    );
  });
});
