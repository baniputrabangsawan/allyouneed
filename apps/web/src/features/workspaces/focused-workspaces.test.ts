import { describe, expect, it } from 'vitest'
import { buildQrPayload, countText, getQrKind, parseQris, processJson } from './focused-workspace-utils'

describe('JSON helpers', () => {
  it('formats, validates, and minifies JSON', () => {
    expect(processJson('{"ok":true}', 'format')).toBe('{\n  "ok": true\n}')
    expect(processJson('{"ok":true}', 'validate')).toBe('Valid JSON')
    expect(processJson('{ "ok": true }', 'minify')).toBe('{"ok":true}')
    expect(() => processJson('{bad}', 'validate')).toThrow()
  })
})

describe('QR payload builders', () => {
  it('selects a payload type from every implementation slug', () => {
    expect(getQrKind('qr-code-generator')).toBe('text')
    expect(getQrKind('url-qr-code')).toBe('url')
    expect(getQrKind('wifi-qr-code')).toBe('wifi')
    expect(getQrKind('whatsapp-qr-code')).toBe('whatsapp')
    expect(getQrKind('email-qr-code')).toBe('email')
    expect(getQrKind('phone-qr-code')).toBe('phone')
    expect(getQrKind('vcard-qr-code')).toBe('vcard')
    expect(getQrKind('location-qr-code')).toBe('location')
  })

  it('builds escaped, standard payloads', () => {
    expect(buildQrPayload('text', { text: 'Hello' })).toBe('Hello')
    expect(buildQrPayload('url', { url: 'https://example.com' })).toBe('https://example.com')
    expect(buildQrPayload('wifi', { ssid: 'Cafe;Net', password: 'p:ass', encryption: 'WPA' })).toBe('WIFI:T:WPA;S:Cafe\\;Net;P:p\\:ass;;')
    expect(buildQrPayload('whatsapp', { phone: '+62 812', message: 'Hello there' })).toBe('https://wa.me/62812?text=Hello%20there')
    expect(buildQrPayload('email', { email: 'a@example.com', subject: 'Hi', body: '' })).toBe('mailto:a@example.com?subject=Hi')
    expect(buildQrPayload('phone', { phone: '+1 555' })).toBe('tel:+1 555')
    expect(buildQrPayload('vcard', { name: 'Ada', organization: 'ACME', phone: '123', email: 'a@example.com', url: 'https://example.com' })).toContain('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Ada')
    expect(buildQrPayload('location', { latitude: '-6.2', longitude: '106.8', label: 'Jakarta' })).toBe('geo:-6.2,106.8?q=-6.2,106.8(Jakarta)')
  })
})

describe('text and QRIS helpers', () => {
  it('counts Unicode code points, words, whitespace, and lines', () => {
    expect(countText('Hello 🌍\nnext line')).toEqual({ words: 4, characters: 17, charactersWithoutSpaces: 14, lines: 2 })
  })

  it('parses EMV TLV and reports a valid CRC', () => {
    const result = parseQris('0002010102116304AD0A')
    expect(result.tags).toEqual([{ tag: '00', value: '01' }, { tag: '01', value: '11' }, { tag: '63', value: 'AD0A' }])
    expect(result.checksum).toBe('valid')
    expect(() => parseQris('010211')).toThrow('Payload Format Indicator')
  })
})
