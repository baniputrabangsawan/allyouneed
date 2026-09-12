import { afterEach, describe, expect, it, vi } from 'vitest'
import { activateLicense } from './licenses'

afterEach(() => vi.unstubAllGlobals())

describe('license API', () => {
  it('maps activation network failures to license server copy', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(
      activateLicense('UTL-PRO-AAAA-BBBB-CCCC', '11111111-1111-4111-8111-111111111111'),
    ).rejects.toMatchObject({
      status: 0,
      code: 'LICENSE_API_UNREACHABLE',
      message: 'Could not reach the license server.',
    })
  })
})
