import { describe, expect, it } from 'vitest'
import { assertProductionApiBaseUrl, isLocalApiHost } from './public-origin'

describe('production API origin guard', () => {
  it('treats loopback hosts as local', () => {
    expect(isLocalApiHost('localhost')).toBe(true)
    expect(isLocalApiHost('127.0.0.1')).toBe(true)
    expect(isLocalApiHost('api.example.com')).toBe(false)
  })

  it('allows empty or HTTPS public origins on build', () => {
    expect(() => assertProductionApiBaseUrl(undefined, 'build')).not.toThrow()
    expect(() => assertProductionApiBaseUrl('https://api.example.com', 'build')).not.toThrow()
    expect(() => assertProductionApiBaseUrl('http://localhost:8000', 'serve')).not.toThrow()
  })

  it('rejects localhost and HTTP origins on production builds', () => {
    expect(() => assertProductionApiBaseUrl('http://localhost:8000', 'build')).toThrow(/localhost/)
    expect(() => assertProductionApiBaseUrl('http://127.0.0.1:8000', 'build')).toThrow(/localhost/)
    expect(() => assertProductionApiBaseUrl('http://api.example.com', 'build')).toThrow(/HTTPS/)
  })
})
