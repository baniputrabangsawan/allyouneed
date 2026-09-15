import { describe, expect, it } from 'vitest'
import {
  formatRegexLiteral,
  highlightSegments,
  INVALID_REGEX,
  normalizeFlags,
  REGEX_MAX_MATCHES,
  SAMPLE_PATTERNS,
  testRegex,
} from './regex-tester'

describe('normalizeFlags', () => {
  it('keeps gimsuy in canonical order and drops unknowns', () => {
    expect(normalizeFlags('yusmigx')).toBe('gimsuy')
    expect(normalizeFlags('gi')).toBe('gi')
    expect(normalizeFlags('')).toBe('')
  })
})

describe('testRegex flags', () => {
  it('matches once without g and every occurrence with g', () => {
    const once = testRegex('a', '', 'abaca')
    const all = testRegex('a', 'g', 'abaca')
    expect(once.ok && once.matches.map((row) => row.index)).toEqual([0])
    expect(all.ok && all.matches.map((row) => row.index)).toEqual([0, 2, 4])
  })

  it('applies i, m, and s', () => {
    const ignore = testRegex('hello', 'i', 'HELLO')
    expect(ignore.ok && ignore.matches[0]?.match).toBe('HELLO')

    const multiline = testRegex('^b', 'm', 'a\nb')
    expect(multiline.ok && multiline.matches[0]?.index).toBe(2)

    const withoutDotAll = testRegex('a.b', '', 'a\nb')
    const withDotAll = testRegex('a.b', 's', 'a\nb')
    expect(withoutDotAll.ok && withoutDotAll.matches).toEqual([])
    expect(withDotAll.ok && withDotAll.matches[0]?.match).toBe('a\nb')
  })

  it('applies sticky y from index 0', () => {
    const stickyMiss = testRegex('bc', 'y', 'abc')
    const stickyHit = testRegex('ab', 'y', 'abc')
    expect(stickyMiss.ok && stickyMiss.matches).toEqual([])
    expect(stickyHit.ok && stickyHit.matches[0]?.match).toBe('ab')
  })
})

describe('testRegex captures', () => {
  it('returns numbered and named groups with start index', () => {
    const numbered = testRegex('(\\d{4})-(\\d{2})-(\\d{2})', '', 'due 2020-01-15')
    expect(numbered).toMatchObject({
      ok: true,
      matches: [{ match: '2020-01-15', index: 4, groups: ['2020', '01', '15'] }],
    })

    const named = testRegex('(?<year>\\d{4})-(?<month>\\d{2})', '', '2020-01')
    expect(named.ok && named.matches[0]).toMatchObject({
      match: '2020-01',
      index: 0,
      groups: ['2020', '01'],
      namedGroups: { year: '2020', month: '01' },
    })
  })
})

describe('testRegex invalid patterns', () => {
  it('returns Invalid regular expression and does not throw', () => {
    for (const pattern of ['(', '[', '*', '(?P<n>x)', '\\']) {
      expect(testRegex(pattern, 'g', 'abc')).toEqual({ ok: false, error: INVALID_REGEX })
    }
  })
})

describe('testRegex unicode', () => {
  it('matches unicode property escapes and emoji with u', () => {
    const letters = testRegex('\\p{L}+', 'gu', 'café 日本語 123')
    expect(letters.ok && letters.matches.map((row) => row.match)).toEqual(['café', '日本語'])

    const emoji = testRegex('😀', 'u', 'hello 😀')
    expect(emoji.ok && emoji.matches[0]).toMatchObject({ match: '😀', index: 6 })
  })

  it('needs u for unicode property matches', () => {
    const withoutU = testRegex('\\p{L}+', 'g', 'café')
    expect(withoutU.ok && withoutU.matches).toEqual([])
  })
})

describe('testRegex empty pattern', () => {
  it('does not search when the pattern is empty', () => {
    expect(testRegex('', 'g', 'aaa')).toEqual({ ok: true, matches: [], truncated: false, textTruncated: false })
  })
})

describe('testRegex limits', () => {
  it('caps matches and marks truncated', () => {
    const result = testRegex('a', 'g', 'a'.repeat(REGEX_MAX_MATCHES + 10))
    expect(result.ok && result.matches).toHaveLength(REGEX_MAX_MATCHES)
    expect(result.ok && result.truncated).toBe(true)
  })

  it('advances past zero-width matches', () => {
    const result = testRegex('(?=a)', 'g', 'aaa')
    expect(result.ok && result.matches.map((row) => row.index)).toEqual([0, 1, 2])
  })
})

describe('highlightSegments', () => {
  it('wraps matches and leaves surrounding text', () => {
    const result = testRegex('a', 'g', 'bab')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(highlightSegments('bab', result.matches).segments).toEqual([
      { text: 'b', matched: false },
      { text: 'a', matched: true },
      { text: 'b', matched: false },
    ])
  })
})

describe('samples and literal', () => {
  it('exposes generic samples that compile', () => {
    expect(SAMPLE_PATTERNS.map((sample) => sample.id)).toEqual(['email', 'url', 'number', 'whitespace', 'hex'])
    for (const sample of SAMPLE_PATTERNS) {
      expect(testRegex(sample.pattern, sample.flags, '').ok).toBe(true)
    }
  })

  it('formats a copyable /pattern/flags literal', () => {
    expect(formatRegexLiteral('a+b', 'gi')).toBe('/a+b/gi')
  })
})
