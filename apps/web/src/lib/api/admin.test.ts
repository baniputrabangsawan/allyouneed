import { describe, expect, it } from 'vitest'
import { createAdminLicense, listAdminLicenses, loginAdmin, logoutAdmin, mutateAdminLicense } from './admin'
import type { ApiClient } from './client'

function client() {
  const calls: Array<{ method: string; path: string; body?: unknown }> = []
  const api = {
    request: async () => ({ data: {} }),
    get: async (path: string) => { calls.push({ method: 'GET', path }); return { data: { items: [], page: 1, pageSize: 25, total: 0, pages: 1 } } },
    post: async (path: string, body?: unknown) => { calls.push({ method: 'POST', path, body }); return { data: {} } },
    delete: async () => ({ data: {} }),
  } as ApiClient
  return { api, calls }
}

describe('admin API', () => {
  it('builds bounded list filters', async () => {
    const { api, calls } = client()
    await listAdminLicenses({ page: 2, pageSize: 25, status: 'unused', search: 'order 42' }, undefined, api)
    expect(calls[0]?.path).toBe('/api/v1/admin/licenses?page=2&page_size=25&status=unused&search=order+42')
  })

  it('uses explicit create and encoded mutation payloads', async () => {
    const { api, calls } = client()
    await createAdminLicense(12, 'reference', undefined, api)
    await mutateAdminLicense('id/unsafe', 'renew', 6, undefined, api)
    expect(calls).toEqual([
      { method: 'POST', path: '/api/v1/admin/licenses', body: { durationMonths: 12, note: 'reference' } },
      { method: 'POST', path: '/api/v1/admin/licenses/id%2Funsafe/renew', body: { durationMonths: 6 } },
    ])
  })

  it('uses server-side authentication endpoints', async () => {
    const { api, calls } = client()
    await loginAdmin('owner@example.com', 'secret password', undefined, api)
    await logoutAdmin(undefined, api)
    expect(calls).toEqual([
      { method: 'POST', path: '/api/v1/admin/auth/login', body: { email: 'owner@example.com', password: 'secret password' } },
      { method: 'POST', path: '/api/v1/admin/auth/logout', body: undefined },
    ])
  })
})
