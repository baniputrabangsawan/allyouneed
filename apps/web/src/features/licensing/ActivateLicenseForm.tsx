import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'
import { activateLicense, deactivateLicense } from '@/lib/api/licenses'
import { getOrCreateInstallationId } from '@/lib/storage/installation'
import { isLicenseKey, normalizeLicenseKey } from '@/lib/storage/license'
import { clearEntitlement, saveEntitlement } from '@/lib/storage/entitlement'
import { isPro, useEntitlement, useStoredEntitlementToken } from './entitlement'

const errorCopy: Record<string, string> = {
  INVALID_LICENSE: 'That license key is not valid.',
  LICENSE_EXPIRED: 'This license has expired.',
  LICENSE_SUSPENDED: 'This license is suspended.',
  LICENSE_REVOKED: 'This license has been revoked.',
  ACTIVATION_LIMIT_REACHED: 'This license is already active on another installation.',
  ACTIVATION_REVOKED: 'This installation is no longer active.',
}

export function ActivateLicenseForm() {
  const queryClient = useQueryClient()
  const token = useStoredEntitlementToken()
  const entitlement = useEntitlement()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const entitled = isPro(entitlement.data)

  async function onActivate(event: FormEvent) {
    event.preventDefault()
    setError('')
    const installationId = getOrCreateInstallationId()
    if (!installationId) {
      setError('This browser cannot store an installation id.')
      return
    }
    if (!isLicenseKey(value)) {
      setError('Enter a valid UTL-PRO license key.')
      return
    }
    setBusy(true)
    try {
      const result = await activateLicense(normalizeLicenseKey(value), installationId)
      saveEntitlement(result.token, {
        plan: result.plan,
        status: result.status,
        expiresAt: result.expiresAt,
        capabilities: result.capabilities,
      })
      setValue('')
      await queryClient.invalidateQueries({ queryKey: ['license-status'] })
    } catch (reason) {
      clearEntitlement()
      const code = reason instanceof ApiError ? reason.code : ''
      setError(errorCopy[code] ?? (reason instanceof ApiError ? reason.message : 'Could not activate this license.'))
    } finally {
      setBusy(false)
    }
  }

  async function onDeactivate() {
    if (!token) return
    setBusy(true)
    setError('')
    setConfirming(false)
    try {
      await deactivateLicense()
    } catch {
      // Local clear still frees this browser even if the request fails.
    } finally {
      clearEntitlement()
      await queryClient.invalidateQueries({ queryKey: ['license-status'] })
      setBusy(false)
    }
  }

  return (
    <form className="license-form" onSubmit={onActivate}>
      {entitled ? (
        <p className="license-status">
          Pro {planLabel(entitlement.data?.plan)} is active on this device until {formatExpiry(entitlement.data?.expiresAt)}.
        </p>
      ) : (
        <p className="license-status">Paste a Pro license key. No account is created.</p>
      )}
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
            {busy ? 'Activating…' : 'Activate License'}
          </button>
        ) : confirming ? (
          <>
            <button className="button primary" type="button" disabled={busy} onClick={onDeactivate}>
              Confirm deactivate
            </button>
            <button className="button secondary" type="button" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="button secondary" type="button" disabled={busy} onClick={() => setConfirming(true)}>
            Deactivate this device
          </button>
        )}
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </form>
  )
}

function formatExpiry(value: string | null | undefined) {
  if (!value) return 'the current period ends'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'the current period ends'
  return date.toLocaleDateString()
}

function planLabel(plan: string | undefined) {
  if (plan === 'pro_12_months') return '12 Months'
  if (plan === 'pro_6_months') return '6 Months'
  if (plan === 'pro_1_month') return '1 Month'
  return ''
}
