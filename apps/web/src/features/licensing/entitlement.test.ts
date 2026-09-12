import { describe, expect, it } from 'vitest'
import { resolveEntitlementState } from './entitlement'

describe('resolveEntitlementState', () => {
  it('stays loading until the client has restored storage', () => {
    expect(resolveEntitlementState({ hydrated: false, hasToken: false, active: false, settled: false })).toBe('loading')
    expect(resolveEntitlementState({ hydrated: false, hasToken: true, active: true, settled: false })).toBe('loading')
  })

  it('is free when no token exists after hydration', () => {
    expect(resolveEntitlementState({ hydrated: true, hasToken: false, active: false, settled: false })).toBe('free')
  })

  it('stays loading while a token is present and verification has not settled', () => {
    expect(resolveEntitlementState({ hydrated: true, hasToken: true, active: false, settled: false })).toBe('loading')
  })

  it('is pro as soon as an active status is known', () => {
    expect(resolveEntitlementState({ hydrated: true, hasToken: true, active: true, settled: false })).toBe('pro')
    expect(resolveEntitlementState({ hydrated: true, hasToken: true, active: true, settled: true })).toBe('pro')
  })

  it('is free after verification settles without an active license', () => {
    expect(resolveEntitlementState({ hydrated: true, hasToken: true, active: false, settled: true })).toBe('free')
  })
})
