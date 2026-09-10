import { describe, expect, it } from 'vitest'
import {
  decodeBase64Text, decodeJwtPayload, encodeBase64Text, hexToRgb, hslToRgb, htmlToMarkdown,
  markdownToSafeHtml, rgbToHex, rgbToHsl, secureRandomInt, secureString, transformText,
} from './workspace-utils'

describe('workspace text utilities', () => {
  it('handles the supported simple text transforms', () => {
    expect(transformText('case-converter', 'hello WORLD', '', 'title')).toBe('Hello World')
    expect(transformText('remove-duplicate-lines', 'one\ntwo\none')).toBe('one\ntwo')
    expect(transformText('remove-extra-spaces', '  one   two \n three  ')).toBe('one two\nthree')
    expect(transformText('sort-lines', 'z\nA\nb')).toBe('A\nb\nz')
    expect(transformText('slug-generator', 'Crème brûlée!')).toBe('creme-brulee')
    expect(transformText('text-compare', 'same', 'same')).toBe('The texts are identical.')
    expect(transformText('text-diff', 'old', 'new')).toBe('- old\n+ new')
  })

  it('escapes Markdown input before producing basic HTML source', () => {
    const output = markdownToSafeHtml('# Hello\n\n<script>alert(1)</script> **world**')
    expect(output).toContain('<h1>Hello</h1>')
    expect(output).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(output).not.toContain('<script>')
    expect(output).toContain('<strong>world</strong>')
  })

  it('converts basic HTML without preserving script content', () => {
    expect(htmlToMarkdown('<h2>Title</h2><script>bad()</script><p><strong>Safe</strong></p>')).toBe('## Title\n\n**Safe**')
  })
})

describe('workspace encoding utilities', () => {
  it('round trips Unicode Base64', () => {
    const text = 'Hello, 世界'
    expect(decodeBase64Text(encodeBase64Text(text))).toBe(text)
  })

  it('decodes a JWT payload without treating it as verification', () => {
    const payload = encodeBase64Text(JSON.stringify({ sub: '123', admin: false })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    expect(decodeJwtPayload(`header.${payload}.signature`)).toBe('{\n  "sub": "123",\n  "admin": false\n}')
    expect(() => decodeJwtPayload('not-a-jwt')).toThrow('three dot-separated')
  })
})

describe('workspace color and randomness utilities', () => {
  it('converts primary colors between HEX, RGB, and HSL', () => {
    const red = hexToRgb('#f00')
    expect(red).toEqual({ r: 255, g: 0, b: 0 })
    expect(rgbToHex(red)).toBe('#FF0000')
    expect(rgbToHsl(red)).toEqual({ h: 0, s: 100, l: 50 })
    expect(hslToRgb({ h: 240, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 })
  })

  it('keeps secure generated values inside requested boundaries', () => {
    for (let index = 0; index < 50; index += 1) expect(secureRandomInt(7, 9)).toBeGreaterThanOrEqual(7)
    const value = secureString(32, 'AB')
    expect(value).toHaveLength(32)
    expect(value).toMatch(/^[AB]+$/)
    expect(() => secureRandomInt(2, 1)).toThrow()
  })
})
