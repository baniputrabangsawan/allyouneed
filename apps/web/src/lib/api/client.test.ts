import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from './client'
import { PRODUCTION_API_ORIGIN } from './public-origin'

afterEach(() => vi.unstubAllGlobals())

describe('API client', () => {
  it('joins the base URL and sends JSON with configured credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"data":{"ok":true}}', {
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createApiClient({ baseUrl: 'https://api.example.test/', credentials: 'include' })
      .post<{ data: { ok: boolean } }>('/jobs', { toolId: 'compress' })

    expect(result.data.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/jobs', expect.objectContaining({
      body: '{"toolId":"compress"}',
      credentials: 'include',
      method: 'POST',
    }))
  })

  it('builds production API requests on the backend origin', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"data":{"ok":true}}'))
    vi.stubGlobal('fetch', fetchMock)

    await createApiClient({ baseUrl: PRODUCTION_API_ORIGIN }).post('/api/v1/licenses/activate', {})

    expect(fetchMock).toHaveBeenCalledWith(`${PRODUCTION_API_ORIGIN}/api/v1/licenses/activate`, expect.any(Object))
  })

  it('throws a typed error for unsuccessful responses', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(
      '{"error":{"code":"INVALID_FILE","message":"Unsupported file."}}',
      { status: 422 },
    )))

    const request = createApiClient({ baseUrl: 'https://api.example.test' }).get('/files')
    await expect(request).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      code: 'INVALID_FILE',
      message: 'Unsupported file.',
    })
  })

  it('maps network failures to API_UNREACHABLE', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(
      createApiClient({ baseUrl: 'http://localhost:8000' }).post('/api/v1/uploads/presign', {}),
    ).rejects.toMatchObject({
      status: 0,
      code: 'API_UNREACHABLE',
      message: 'Could not reach the processing server.',
    })
  })

  it('turns its timeout into a typed error', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })))

    await expect(createApiClient({ timeoutMs: 1 }).get('/slow')).rejects.toMatchObject({
      status: 0,
      code: 'TIMEOUT',
    })
  })

  it('attaches extra headers from the client config', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"data":{}}', {
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await createApiClient({
      baseUrl: 'https://api.example.test',
      headers: () => ({ 'X-Entitlement-Token': 'token.sig' }),
    }).get('/api/v1/licenses/status')

    const init = fetchMock.mock.calls[0]?.[1]
    const headers = new Headers(init?.headers)
    expect(headers.get('X-Entitlement-Token')).toBe('token.sig')
  })

  it('does not leak configured API headers to an external absolute URL', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await createApiClient({
      baseUrl: 'https://api.example.test',
      headers: () => ({
        'X-Entitlement-Token': 'token.sig',
        'X-CSRF-Token': 'csrf-secret',
      }),
    }).request('https://storage.example.test/presigned-object', {
      method: 'PUT',
      body: new Blob(['file']),
    })

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(headers.has('X-Entitlement-Token')).toBe(false)
    expect(headers.has('X-CSRF-Token')).toBe(false)
  })
})
