import { describe, expect, it } from "vitest";
import {
  assertProductionApiBaseUrl,
  isLocalApiHost,
  PRODUCTION_API_ORIGIN,
  resolveApiBaseUrl,
  resolveApiOrigin,
} from "./public-origin";

describe("production API origin guard", () => {
  it("treats loopback hosts as local", () => {
    expect(isLocalApiHost("localhost")).toBe(true);
    expect(isLocalApiHost("127.0.0.1")).toBe(true);
    expect(isLocalApiHost("api.example.com")).toBe(false);
  });

  it("uses the public API origin when production env is empty", () => {
    expect(resolveApiBaseUrl(undefined, "prod")).toBe(PRODUCTION_API_ORIGIN);
    expect(resolveApiBaseUrl("  ", "prod")).toBe(PRODUCTION_API_ORIGIN);
    expect(resolveApiBaseUrl(undefined, "dev")).toBe("http://localhost:8000");
    expect(resolveApiBaseUrl("https://api.example.com/", "prod")).toBe(
      "https://api.example.com",
    );
  });

  it("normalizes the configured API URL to a safe CSP origin", () => {
    expect(resolveApiOrigin("http://127.0.0.1:8010/api/v1/", "dev")).toBe(
      "http://127.0.0.1:8010",
    );
    expect(() => resolveApiOrigin("javascript:alert(1)", "dev")).toThrow(
      "VITE_API_BASE_URL is not a valid HTTP(S) URL",
    );
  });

  it("allows empty or HTTPS public origins on build", () => {
    expect(() => assertProductionApiBaseUrl(undefined, "build")).not.toThrow();
    expect(() =>
      assertProductionApiBaseUrl("https://api.example.com", "build"),
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
  });
});
