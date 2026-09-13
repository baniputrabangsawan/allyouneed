import {
  ApiError,
  apiClient,
  type ApiClient,
  type ApiRequestOptions,
} from "./client";
import type { ApiResponse } from "./types";
import type {
  EntitlementPayload,
  LicenseStatusView,
} from "@/features/licensing/types";
import type { InstallationCredentials } from "@/lib/storage/installation";

export type {
  EntitlementPayload,
  LicensePlan,
  LicenseStatus,
  LicenseStatusView,
} from "@/features/licensing/types";

export const activateLicense = async (
  licenseKey: string,
  credentials: InstallationCredentials,
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<EntitlementPayload> => {
  try {
    return (
      await client.post<ApiResponse<EntitlementPayload>>(
        "/api/v1/licenses/activate",
        { licenseKey, ...credentials },
        options,
      )
    ).data;
  } catch (reason) {
    throw licenseError(reason);
  }
};

export const refreshLicense = async (
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<EntitlementPayload> =>
  (
    await client.post<ApiResponse<EntitlementPayload>>(
      "/api/v1/licenses/refresh",
      undefined,
      options,
    )
  ).data;

export const deactivateLicense = async (
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<LicenseStatusView> =>
  (
    await client.post<ApiResponse<LicenseStatusView>>(
      "/api/v1/licenses/deactivate",
      undefined,
      options,
    )
  ).data;

export const getLicenseStatus = async (
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<LicenseStatusView> =>
  (
    await client.get<ApiResponse<LicenseStatusView>>(
      "/api/v1/licenses/status",
      options,
    )
  ).data;

function licenseError(reason: unknown): unknown {
  if (
    reason instanceof ApiError &&
    (reason.code === "API_UNREACHABLE" || reason.code === "TIMEOUT")
  ) {
    return new ApiError("Could not reach the license server.", {
      status: reason.status,
      code: "LICENSE_API_UNREACHABLE",
      cause: reason,
    });
  }
  return reason;
}
