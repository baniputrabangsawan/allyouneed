import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { activateLicense, deactivateLicense } from "@/lib/api/licenses";
import { getOrCreateInstallationCredentials } from "@/lib/storage/installation";
import { isLicenseKey, normalizeLicenseKey } from "@/lib/storage/license";
import { clearEntitlement, saveEntitlement } from "@/lib/storage/entitlement";
import { useEntitlement, useStoredEntitlementToken } from "./entitlement";
import { entitlementQueryKeys } from "./query-keys";

const errorCopy: Record<string, string> = {
  LICENSE_API_UNREACHABLE: "Could not reach the license server.",
  API_UNREACHABLE: "Could not reach the license server.",
  TIMEOUT: "Could not reach the license server.",
  INVALID_LICENSE: "This license key is invalid.",
  LICENSE_EXPIRED: "This license has expired.",
  LICENSE_SUSPENDED: "This license is suspended.",
  LICENSE_REVOKED: "This license has been revoked.",
  ACTIVATION_LIMIT_REACHED:
    "This license is already active on another browser.",
  ACTIVATION_REVOKED: "This installation is no longer active.",
  ACTIVATION_FAILED: "Could not activate this license.",
};

export function ActivateLicenseForm() {
  const queryClient = useQueryClient();
  const token = useStoredEntitlementToken();
  const entitlement = useEntitlement();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [activated, setActivated] = useState(false);
  if (entitlement.state === "loading") {
    return (
      <div
        className="license-form entitlement-loading"
        aria-busy="true"
        aria-label="Checking license"
      />
    );
  }
  const entitled = entitlement.state === "pro";

  async function onActivate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setActivated(false);
    const credentials = getOrCreateInstallationCredentials();
    if (!credentials) {
      setError("This browser cannot store secure installation credentials.");
      return;
    }
    if (!isLicenseKey(value)) {
      setError("Enter a valid UTL-PRO license key.");
      return;
    }
    setBusy(true);
    try {
      const result = await activateLicense(
        normalizeLicenseKey(value),
        credentials,
      );
      saveEntitlement(result.token, {
        plan: result.plan,
        status: result.status,
        expiresAt: result.expiresAt,
        capabilities: result.capabilities,
      });
      setValue("");
      setActivated(true);
      await queryClient.invalidateQueries({
        queryKey: entitlementQueryKeys.all,
      });
    } catch (reason) {
      clearEntitlement();
      const code = reason instanceof ApiError ? reason.code : "";
      setError(
        errorCopy[code] ??
          (reason instanceof ApiError
            ? reason.message
            : "Could not activate this license."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate() {
    if (!token) return;
    setBusy(true);
    setError("");
    setConfirming(false);
    try {
      await deactivateLicense();
    } catch {
      // Local clear still frees this browser even if the request fails.
    } finally {
      clearEntitlement();
      await queryClient.invalidateQueries({
        queryKey: entitlementQueryKeys.all,
      });
      setBusy(false);
    }
  }

  return (
    <form className="license-form" onSubmit={onActivate}>
      {entitled ? (
        <p className="license-status">
          Pro {planLabel(entitlement.data?.plan)} is active on this device until{" "}
          {formatExpiry(entitlement.data?.expiresAt)}.
        </p>
      ) : (
        <p className="license-status">
          Paste a Pro license key. No account is created.
        </p>
      )}
      {entitled && activated ? (
        <p className="license-success">Pro activated</p>
      ) : null}
      {entitled ? (
        <dl className="license-details">
          <div>
            <dt>Plan</dt>
            <dd>Pro</dd>
          </div>
          <div>
            <dt>Expires</dt>
            <dd>{formatExpiry(entitlement.data?.expiresAt)}</dd>
          </div>
          <div>
            <dt>Installation</dt>
            <dd>
              {entitlement.data?.installationActive === false
                ? "Inactive"
                : "Active"}
            </dd>
          </div>
        </dl>
      ) : null}
      {!entitled ? (
        <label className="field">
          <span>License key</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="UTL-PRO-____-____-____"
          />
        </label>
      ) : null}
      <div className="button-row">
        {!entitled ? (
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle size={16} />
                Activating...
              </>
            ) : (
              "Activate License"
            )}
          </button>
        ) : activated ? (
          <a className="button primary" href="/">
            Continue
          </a>
        ) : confirming ? (
          <>
            <button
              className="button primary"
              type="button"
              disabled={busy}
              onClick={onDeactivate}
            >
              Confirm deactivate
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            Deactivate this device
          </button>
        )}
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function formatExpiry(value: string | null | undefined) {
  if (!value) return "the current period ends";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "the current period ends";
  return date.toLocaleDateString();
}

function planLabel(plan: string | undefined) {
  if (plan === "pro_12_months") return "12 Months";
  if (plan === "pro_6_months") return "6 Months";
  if (plan === "pro_1_month") return "1 Month";
  return "";
}
