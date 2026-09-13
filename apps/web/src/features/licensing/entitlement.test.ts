import { describe, expect, it } from 'vitest'
import { canUseTool, resolveEntitlementState } from './entitlement'
import { getToolBySlug } from '@/features/tools/tool-registry'

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

describe('canUseTool', () => {
  const freeTool = getToolBySlug('word-counter')!
  const proTool = getToolBySlug('speech-to-text')!

  it('allows free tools without an entitlement', () => {
    expect(canUseTool(freeTool, undefined)).toBe(true)
  })

  it('requires an active entitlement with the tool capability', () => {
    expect(canUseTool(proTool, undefined)).toBe(false)
    expect(canUseTool(proTool, {
      plan: 'pro_1_month',
      status: 'active',
      expiresAt: null,
      capabilities: ['audio.speech_to_text'],
    })).toBe(true)
    expect(canUseTool(proTool, {
      plan: 'pro_1_month',
      status: 'active',
      expiresAt: null,
      capabilities: ['audio.text_to_speech'],
    })).toBe(false)
  })
})
