import { afterEach, describe, expect, it, vi } from "vitest";
import { activateLicense } from "./licenses";
import type { ApiClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("license API", () => {
  it("posts activation through the canonical backend license endpoint", async () => {
    const post = vi.fn<ApiClient["post"]>().mockResolvedValue({ data: { token: "token", plan: "pro_1_month", status: "active", expiresAt: "2026-01-01T00:00:00Z", capabilities: [], installationActive: true } });
    await activateLicense("UTL-PRO-AAAA-BBBB-CCCC", {
      installationId: "11111111-1111-4111-8111-111111111111",
      deviceSecret: "a".repeat(43),
    }, undefined, { post } as unknown as ApiClient);

    expect(post).toHaveBeenCalledWith("/api/v1/licenses/activate", expect.objectContaining({ licenseKey: "UTL-PRO-AAAA-BBBB-CCCC" }), undefined);
  });

  it("maps activation network failures to license server copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(
      activateLicense("UTL-PRO-AAAA-BBBB-CCCC", {
        installationId: "11111111-1111-4111-8111-111111111111",
        deviceSecret: "a".repeat(43),
      }),
    ).rejects.toMatchObject({
      status: 0,
      code: "LICENSE_API_UNREACHABLE",
      message: "Could not reach the license server.",
    });
  });
});
