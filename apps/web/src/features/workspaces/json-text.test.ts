import { describe, expect, it } from 'vitest'
import { textDownloadName, textFromJsonPayload } from './json-text'

describe('textFromJsonPayload', () => {
  it('returns the text field with real newlines', () => {
    expect(textFromJsonPayload({ text: 'Hello\n\nWorld' })).toBe('Hello\n\nWorld')
  })

  it('returns null for raw JSON without a text string', () => {
    expect(textFromJsonPayload({ filename: 'out.json' })).toBeNull()
    expect(textFromJsonPayload('{"text":"no"}')).toBeNull()
  })
})

describe('textDownloadName', () => {
  it('swaps the extension for txt', () => {
    expect(textDownloadName('questions.pdf')).toBe('questions.txt')
    expect(textDownloadName('pdf-to-text-result.json')).toBe('pdf-to-text-result.txt')
  })
})
