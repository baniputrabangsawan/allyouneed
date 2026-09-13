import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  changeAdminPassword,
  confirmAdminTotp,
  disableAdminTotp,
  setupAdminTotp,
} from '@/lib/api/admin'
import { adminErrorMessage } from './admin-error'
import { adminQueryKeys } from './query-keys'

export function SecuritySettings({ totpEnabled }: { totpEnabled: boolean }) {
  const queryClient = useQueryClient()
  const [passwordCurrent, setPasswordCurrent] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [totpPassword, setTotpPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState<{ secret: string; provisioningUri: string } | null>(null)
  const [recovery, setRecovery] = useState<string[]>([])

  const password = useMutation({
    mutationFn: () => changeAdminPassword(passwordCurrent, newPassword),
    onSuccess: () => {
      setPasswordCurrent('')
      setNewPassword('')
    },
  })
  const startTotp = useMutation({
    mutationFn: () => setupAdminTotp(totpPassword),
    onSuccess: setSetup,
  })
  const confirmTotp = useMutation({
    mutationFn: () => confirmAdminTotp(code),
    onSuccess: async (result) => {
      setRecovery(result.recoveryCodes)
      setSetup(null)
      setCode('')
      setTotpPassword('')
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.identity() })
    },
  })
  const disableTotp = useMutation({
    mutationFn: () => disableAdminTotp(totpPassword, code),
    onSuccess: async () => {
      setTotpPassword('')
      setCode('')
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.identity() })
    },
  })
  const error = password.error ?? startTotp.error ?? confirmTotp.error ?? disableTotp.error
  const isTotpPending = startTotp.isPending || confirmTotp.isPending || disableTotp.isPending

  return (
    <section className="admin-security-settings">
      <div>
        <p className="eyebrow">Credentials</p>
        <h2>Security settings</h2>
        <p>FastAPI manages this browser's opaque server-side session.</p>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); password.mutate() }}>
        <h3>Change password</h3>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={passwordCurrent}
            onChange={(event) => setPasswordCurrent(event.target.value)}
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </label>
        <button className="button" disabled={password.isPending}>Change password</button>
      </form>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (setup) confirmTotp.mutate()
        else if (totpEnabled) disableTotp.mutate()
        else startTotp.mutate()
      }}>
        <h3>Authenticator app</h3>
        <p>{totpEnabled ? 'TOTP is enabled.' : 'Add a second factor using any TOTP authenticator.'}</p>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={totpPassword}
            onChange={(event) => setTotpPassword(event.target.value)}
            required
          />
        </label>
        {setup && <><code>{setup.secret}</code><small>{setup.provisioningUri}</small></>}
        {(setup || totpEnabled) && (
          <label>
            Authentication code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              required
            />
          </label>
        )}
        <button className="button" disabled={isTotpPending}>
          {setup ? 'Confirm TOTP' : totpEnabled ? 'Disable TOTP' : 'Set up TOTP'}
        </button>
      </form>
      {recovery.length > 0 && (
        <div className="admin-recovery">
          <strong>Recovery codes</strong>
          <p>Shown once. Store them safely.</p>
          {recovery.map((item) => <code key={item}>{item}</code>)}
        </div>
      )}
      {error && <p className="admin-error" role="alert">{adminErrorMessage(error)}</p>}
    </section>
  )
}
