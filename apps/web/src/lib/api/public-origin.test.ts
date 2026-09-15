import { describe, expect, it } from "vitest";
import {
  assertProductionApiBaseUrl,
  isLocalApiHost,
  PRODUCTION_API_ORIGIN,
  PRODUCTION_WEB_ORIGIN,
  resolveApiBaseUrl,
  resolveApiOrigin,
} from "./public-origin";

describe("production API origin guard", () => {
  it("treats loopback hosts as local", () => {
    expect(isLocalApiHost("localhost")).toBe(true);
    expect(isLocalApiHost("127.0.0.1")).toBe(true);
    expect(isLocalApiHost("api.example.com")).toBe(false);
  });

  it("requires an explicit API origin in production", () => {
    expect(() => resolveApiBaseUrl(undefined, "prod")).toThrow(/configured/);
    expect(() => resolveApiBaseUrl("  ", "prod")).toThrow(/configured/);
    expect(resolveApiBaseUrl(undefined, "dev")).toBe("http://localhost:8000");
    expect(resolveApiBaseUrl(`${PRODUCTION_API_ORIGIN}/`, "prod")).toBe(PRODUCTION_API_ORIGIN);
  });

  it("normalizes the configured API URL to a safe CSP origin", () => {
    expect(resolveApiOrigin("http://127.0.0.1:8010/api/v1/", "dev")).toBe(
      "http://127.0.0.1:8010",
    );
    expect(() => resolveApiOrigin("javascript:alert(1)", "dev")).toThrow(
      "VITE_API_BASE_URL is not a valid HTTP(S) URL",
    );
  });

  it("allows only an explicit HTTPS public API origin on build", () => {
    expect(() => assertProductionApiBaseUrl(undefined, "build")).toThrow(/configured/);
    expect(() =>
      assertProductionApiBaseUrl(PRODUCTION_API_ORIGIN, "build"),
    ).not.toThrow();
    expect(() =>
      assertProductionApiBaseUrl("http://localhost:8000", "serve"),
    ).not.toThrow();
  });

  it("rejects localhost and HTTP origins on production builds", () => {
    expect(() =>
      assertProductionApiBaseUrl("http://localhost:8000", "build"),
    ).toThrow(/localhost/);
    expect(() =>
      assertProductionApiBaseUrl("http://127.0.0.1:8000", "build"),
    ).toThrow(/localhost/);
    expect(() =>
      assertProductionApiBaseUrl("http://api.example.com", "build"),
    ).toThrow(/HTTPS/);
    expect(() =>
      assertProductionApiBaseUrl(PRODUCTION_WEB_ORIGIN, "build"),
    ).toThrow(/frontend origin/);
  });
});
