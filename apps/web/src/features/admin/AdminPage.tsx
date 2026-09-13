import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Clipboard, FileClock, KeyRound, LayoutDashboard, LogOut, Plus, Search, ShieldCheck, X } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { createAdminLicense, getAdminIdentity, getAdminOverview, getAdminSystemHealth, listAdminAudit, listAdminLicenses, mutateAdminLicense, logoutAdmin, type AdminDisplayStatus, type AdminLicense, type DurationMonths, type IssuedAdminLicense } from '@/lib/api/admin'
import { adminErrorMessage } from './admin-error'
import { adminQueryKeys } from './query-keys'
import { SecuritySettings } from './SecuritySettings'

export type AdminView = 'overview' | 'licenses' | 'audit' | 'system'
const nav = [
  ['overview', '/admin', LayoutDashboard],
  ['licenses', '/admin/licenses', KeyRound],
  ['audit', '/admin/audit', FileClock],
  ['system', '/admin/system', Activity],
] as const
const labels = {
  overview: 'Overview',
  licenses: 'Licenses',
  audit: 'Audit log',
  system: 'System',
}
const date = (value: string | null) => (value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Not yet')
const displayStatus = (license: AdminLicense): AdminDisplayStatus => (license.status === 'active' && !license.activatedAt ? 'unused' : license.status)
const errorMessage = adminErrorMessage

export function AdminPage({ view }: { view: AdminView }) {
  const navigate = useNavigate()
  const identity = useQuery({
    queryKey: adminQueryKeys.identity(),
    queryFn: () => getAdminIdentity(),
    retry: false,
  })
  const logout = useMutation({
    mutationFn: () => logoutAdmin(),
    onSuccess: () => void navigate({ to: '/admin/login' }),
  })
  useEffect(() => {
    if (identity.isError) void navigate({ to: '/admin/login', replace: true })
  }, [identity.isError, navigate])
  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-brand">
          <span>
            <ShieldCheck size={18} />
          </span>
          <strong>Kits</strong>
          <small>Admin</small>
        </Link>
        <nav aria-label="Admin navigation">
          {nav.map(([key, to, Icon]) => (
            <Link key={key} to={to} className={view === key ? 'active' : ''}>
              <Icon size={17} />
              {labels[key]}
            </Link>
          ))}
        </nav>
        <div className="admin-identity">
          <span>Signed in as</span>
          <strong>{identity.data?.email ?? 'Checking session...'}</strong>
          {identity.data && (
            <button type="button" onClick={() => logout.mutate()}>
              <LogOut size={15} />
              Sign out
            </button>
          )}
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">Owner operations</p>
            <h1>{labels[view]}</h1>
          </div>
          <span className="admin-verified">
            <ShieldCheck size={15} /> Admin session active
          </span>
        </header>
        {identity.isError ? <AccessDenied error={identity.error} /> : identity.isPending ? <Loading /> : view === 'overview' ? <Overview /> : view === 'licenses' ? <Licenses /> : view === 'audit' ? <Audit /> : <System />}
      </main>
    </div>
  )
}

function Loading() {
  return (
    <div className="admin-state" aria-live="polite">
      Loading secure workspace...
    </div>
  )
}
function AccessDenied({ error }: { error: unknown }) {
  return (
    <div className="admin-state" role="alert">
      <ShieldCheck size={28} />
      <h2>Admin access unavailable</h2>
      <p>{errorMessage(error)}</p>
    </div>
  )
}

function Overview() {
  const query = useQuery({
    queryKey: adminQueryKeys.overview(),
    queryFn: () => getAdminOverview(),
  })
  if (query.isPending) return <Loading />
  if (query.isError) return <AccessDenied error={query.error} />
  const metrics = [
    ['Active licenses', query.data.active],
    ['Unused licenses', query.data.unused],
    ['Expiring soon', query.data.expiringSoon],
    ['Revoked licenses', query.data.revoked],
    ['Created this month', query.data.createdThisMonth],
  ]
  return (
    <section>
      <div className="admin-metrics">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="admin-callout">
        <div>
          <p className="eyebrow">Security posture</p>
          <h2>Licenses stay opaque by default.</h2>
          <p>Keys are shown once at creation. Stored digests, installation hashes, and signing secrets never enter this dashboard.</p>
        </div>
        <ShieldCheck size={34} />
      </div>
    </section>
  )
}

function Licenses() {
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AdminDisplayStatus | ''>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [issued, setIssued] = useState<IssuedAdminLicense | null>(null)
  const [confirm, setConfirm] = useState<{
    license: AdminLicense
    action: 'renew' | 'suspend' | 'resume' | 'revoke' | 'reset-activations'
  } | null>(null)
  const licenses = useQuery({
    queryKey: adminQueryKeys.licenses(page, search, status),
    queryFn: () =>
      listAdminLicenses({
        page,
        pageSize: 25,
        search,
        ...(status ? { status } : {}),
      }),
  })
  const action = useMutation({
    mutationFn: ({ id, action, duration }: { id: string; action: 'renew' | 'suspend' | 'resume' | 'revoke' | 'reset-activations'; duration?: DurationMonths }) => mutateAdminLicense(id, action, duration),
    onSuccess: async () => {
      setConfirm(null)
      await client.invalidateQueries({ queryKey: adminQueryKeys.all })
    },
  })
  return (
    <section>
      <div className="admin-toolbar">
        <form role="search" onSubmit={(event) => event.preventDefault()}>
          <Search size={16} />
          <input
            aria-label="Search licenses"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="ID, key prefix, or note"
          />
        </form>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as AdminDisplayStatus | '')
            setPage(1)
          }}
        >
          <option value="">All statuses</option>
          {['unused', 'active', 'suspended', 'expired', 'revoked'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button className="button primary" type="button" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Create license
        </button>
      </div>
      {licenses.isError && (
        <p className="admin-error" role="alert">
          {errorMessage(licenses.error)}
        </p>
      )}
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">License</th>
              <th scope="col">Plan</th>
              <th scope="col">Status</th>
              <th scope="col">Created</th>
              <th scope="col">Activated</th>
              <th scope="col">Expires</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {licenses.data?.items.map((license) => (
              <LicenseRow key={license.licenseId} license={license} onAction={(next) => setConfirm({ license, action: next })} />
            ))}
            {licenses.data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="admin-empty-row">
                  No licenses match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {licenses.data && (
        <div className="admin-pagination">
          <span>{licenses.data.total} licenses</span>
          <div>
            <button className="button ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {licenses.data.pages}
            </span>
            <button className="button ghost" disabled={page >= licenses.data.pages} onClick={() => setPage((value) => value + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
      <CreateDialog
        open={createOpen}
        issued={issued}
        onIssued={setIssued}
        onClose={() => {
          setCreateOpen(false)
          setIssued(null)
          void client.invalidateQueries({ queryKey: adminQueryKeys.all })
        }}
      />
      <ConfirmDialog
        value={confirm}
        pending={action.isPending}
        error={action.error}
        onClose={() => setConfirm(null)}
        onConfirm={(duration) => {
          if (confirm)
            action.mutate({
              id: confirm.license.licenseId,
              action: confirm.action,
              ...(duration ? { duration } : {}),
            })
        }}
      />
    </section>
  )
}

function LicenseRow({ license, onAction }: { license: AdminLicense; onAction: (action: 'renew' | 'suspend' | 'resume' | 'revoke' | 'reset-activations') => void }) {
  const state = displayStatus(license)
  return (
    <tr>
      <th scope="row">
        <strong>{license.keyPrefix ?? 'KITS'}</strong>
        <small>{license.licenseId.slice(0, 8)}</small>
      </th>
      <td>{license.plan.replace('pro_', '').replace('_months', ' months').replace('_month', ' month')}</td>
      <td>
        <span className={`admin-status ${state}`}>{state}</span>
      </td>
      <td>
        <time dateTime={license.createdAt}>{date(license.createdAt)}</time>
      </td>
      <td>{date(license.activatedAt)}</td>
      <td>{date(license.expiresAt)}</td>
      <td>
        <div className="admin-row-actions">
          {license.status !== 'revoked' && <button onClick={() => onAction('renew')}>Renew</button>}
          {license.status === 'suspended' ? <button onClick={() => onAction('resume')}>Resume</button> : license.status === 'active' && <button onClick={() => onAction('suspend')}>Suspend</button>}
          {license.installationActive && <button onClick={() => onAction('reset-activations')}>Reset</button>}
          {license.status !== 'revoked' && (
            <button className="danger" onClick={() => onAction('revoke')}>
              Revoke
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function CreateDialog({ open, issued, onIssued, onClose }: { open: boolean; issued: IssuedAdminLicense | null; onIssued: (value: IssuedAdminLicense) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [duration, setDuration] = useState<DurationMonths>(1)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const create = useMutation({
    mutationFn: () => createAdminLicense(duration, note),
    onSuccess: onIssued,
  })
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])
  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(id)
  }, [copied])
  const close = () => {
    create.reset()
    setNote('')
    setCopied(false)
    setCopyError('')
    onClose()
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }
  async function copyKey() {
    const key = issued?.licenseKey
    if (!key) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(key)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = key
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.append(textarea)
        textarea.select()
        const ok = document.execCommand('copy')
        textarea.remove()
        if (!ok) throw new Error('Copy failed')
      }
      setCopied(true)
      setCopyError('')
    } catch {
      setCopied(false)
      setCopyError('Could not copy the license key. Select and copy it manually.')
    }
  }
  return (
    <dialog ref={dialog} className="admin-dialog" aria-labelledby="create-title" onCancel={close} onClose={close}>
      <div>
        {issued ? (
          <>
            <button className="admin-dialog-close" aria-label="Close" onClick={close}>
              <X size={18} />
            </button>
            <p className="eyebrow">License created</p>
            <h2 id="create-title">Copy this key now.</h2>
            <p>This key is shown once. Store or send it safely before closing.</p>
            <code className="admin-license-key">{issued.licenseKey}</code>
            {copied && (
              <p className="admin-success" role="status">
                License key copied
              </p>
            )}
            {copyError && (
              <p className="admin-error" role="alert">
                {copyError}
              </p>
            )}
            <button className="button primary" onClick={() => void copyKey()} disabled={!issued.licenseKey}>
              <Clipboard size={16} />
              {copied ? 'Copied' : 'Copy license key'}
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <button className="admin-dialog-close" type="button" aria-label="Close" onClick={close}>
              <X size={18} />
            </button>
            <p className="eyebrow">New entitlement</p>
            <h2 id="create-title">Create license</h2>
            <label>
              Duration
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value) as DurationMonths)}>
                <option value={1}>1 month</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
            </label>
            <label>
              Internal note <span>Optional</span>
              <input maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Order reference" />
            </label>
            {create.isError && (
              <p className="admin-error" role="alert">
                {errorMessage(create.error)}
              </p>
            )}
            <div className="button-row">
              <button className="button ghost" type="button" onClick={close}>
                Cancel
              </button>
              <button className="button primary" disabled={create.isPending}>
                {create.isPending ? 'Creating...' : 'Create license'}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  )
}

function ConfirmDialog({ value, pending, error, onClose, onConfirm }: { value: { license: AdminLicense; action: string } | null; pending: boolean; error: unknown; onClose: () => void; onConfirm: (duration?: DurationMonths) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [duration, setDuration] = useState<DurationMonths>(1)
  useEffect(() => {
    if (value && !dialog.current?.open) dialog.current?.showModal()
    if (!value && dialog.current?.open) dialog.current.close()
  }, [value])
  if (!value) return <dialog ref={dialog} />
  const destructive = value.action === 'revoke'
  const title = `${value.action.replace('-', ' ')} this license?`
  return (
    <dialog
      ref={dialog}
      className="admin-dialog"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div>
        <p className="eyebrow">Confirm action</p>
        <h2 id="confirm-title">{title}</h2>
        <p>{destructive ? 'This immediately removes Pro access and cannot be reversed.' : value.action === 'reset-activations' ? 'The license can activate on another browser or device afterward.' : 'The backend will verify that this state transition is allowed.'}</p>
        {value.action === 'renew' && (
          <label>
            Extend by
            <select value={duration} onChange={(event) => setDuration(Number(event.target.value) as DurationMonths)}>
              <option value={1}>1 month</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </select>
          </label>
        )}
        {error !== null && error !== undefined ? (
          <p className="admin-error" role="alert">
            {errorMessage(error)}
          </p>
        ) : null}
        <div className="button-row">
          <button className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button className={`button ${destructive ? 'danger-button' : 'primary'}`} disabled={pending} onClick={() => onConfirm(value.action === 'renew' ? duration : undefined)}>
            {pending ? 'Working...' : `Confirm ${value.action.replace('-', ' ')}`}
          </button>
        </div>
      </div>
    </dialog>
  )
}

function Audit() {
  const query = useQuery({
    queryKey: adminQueryKeys.audit(),
    queryFn: () => listAdminAudit(),
  })
  if (query.isPending) return <Loading />
  if (query.isError) return <AccessDenied error={query.error} />
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Administrator</th>
            <th>License</th>
            <th>Request ID</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {query.data.items.map((event) => (
            <tr key={event.id}>
              <th>{event.action.replaceAll('_', ' ')}</th>
              <td>{event.adminEmail}</td>
              <td>
                <code>{event.targetLicenseId?.slice(0, 8) ?? 'Admin'}</code>
              </td>
              <td>
                <code>{event.requestId}</code>
              </td>
              <td>
                <time dateTime={event.at}>{date(event.at)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function System() {
  const identity = useQuery({
    queryKey: adminQueryKeys.identity(),
    queryFn: () => getAdminIdentity(),
    retry: false,
  })
  const query = useQuery({
    queryKey: adminQueryKeys.system(),
    queryFn: () => getAdminSystemHealth(),
    refetchInterval: 30_000,
  })
  if (query.isPending) return <Loading />
  if (query.isError) return <AccessDenied error={query.error} />
  return (
    <>
      <div className="admin-health">
        {Object.entries(query.data).map(([name, state]) => (
          <article key={name}>
            <span>{name}</span>
            <strong className={String(state)}>{String(state)}</strong>
          </article>
        ))}
      </div>
      <SecuritySettings totpEnabled={identity.data?.totpEnabled ?? false} />
    </>
  )
}
