import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { ApiError } from '@/lib/api/client'
import { loginAdmin, verifyAdminTotp } from '@/lib/api/admin'

const message = (error: unknown) => error instanceof ApiError ? error.message : 'Unable to sign in.'

export function AdminLoginPage() {
  const [totp, setTotp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const login = useMutation({ mutationFn: () => loginAdmin(email, password), onSuccess: (result) => { if (result.requiresTotp) setTotp(true); else window.location.assign('/admin') } })
  const verify = useMutation({ mutationFn: () => verifyAdminTotp(code), onSuccess: () => window.location.assign('/admin') })
  const submit = (event: FormEvent) => { event.preventDefault(); if (totp) verify.mutate(); else login.mutate() }
  const error = totp ? verify.error : login.error
  const pending = totp ? verify.isPending : login.isPending
  return <main className="admin-login"><section><div className="admin-login-mark"><ShieldCheck size={22} /></div><p className="eyebrow">Kits owner</p><h1>{totp ? 'Verify your identity' : 'Sign in to Admin'}</h1><p>{totp ? 'Enter the six-digit code from your authenticator, or a recovery code.' : 'Use the owner credentials configured on this server.'}</p><form onSubmit={submit}>{totp ? <label>Authentication code<input autoFocus autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} required /></label> : <><label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label></>}{error && <p className="admin-error" role="alert">{message(error)}</p>}<button className="button primary" disabled={pending}><KeyRound size={16} />{pending ? 'Checking...' : totp ? 'Verify code' : 'Sign in'}</button></form></section></main>
}
