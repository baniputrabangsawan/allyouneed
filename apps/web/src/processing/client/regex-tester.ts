export const REGEX_FLAGS = ['g', 'i', 'm', 's', 'u', 'y'] as const
export type RegexFlag = (typeof REGEX_FLAGS)[number]

export const REGEX_MAX_MATCHES = 500
export const REGEX_MAX_CHARS = 2_000_000
export const REGEX_HIGHLIGHT_CHARS = 20_000
export const INVALID_REGEX = 'Invalid regular expression'

export interface RegexMatch {
  match: string
  index: number
  groups: string[]
  namedGroups?: Record<string, string>
}

export type RegexTestResult =
  | { ok: true; matches: RegexMatch[]; truncated: boolean; textTruncated: boolean }
  | { ok: false; error: typeof INVALID_REGEX }

export interface HighlightSegment {
  text: string
  matched: boolean
}

export const SAMPLE_PATTERNS: ReadonlyArray<{ id: string; label: string; pattern: string; flags: string }> = [
  { id: 'email', label: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', flags: 'g' },
  { id: 'url', label: 'URL', pattern: 'https?:\\/\\/[^\\s]+', flags: 'g' },
  { id: 'number', label: 'Number', pattern: '-?\\d+(\\.\\d+)?', flags: 'g' },
  { id: 'whitespace', label: 'Whitespace', pattern: '\\s+', flags: 'g' },
  { id: 'hex', label: 'Hex color', pattern: '#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b', flags: 'g' },
]

export function normalizeFlags(flags: string): string {
  const set = new Set(flags)
  return REGEX_FLAGS.filter((flag) => set.has(flag)).join('')
}

export function formatRegexLiteral(pattern: string, flags: string): string {
  return `/${pattern}/${normalizeFlags(flags)}`
}

export function testRegex(
  pattern: string,
  flags: string,
  text: string,
  limit = REGEX_MAX_MATCHES,
): RegexTestResult {
  const textTruncated = text.length > REGEX_MAX_CHARS
  if (pattern === '') {
    return { ok: true, matches: [], truncated: false, textTruncated }
  }

  let re: RegExp
  try {
    re = new RegExp(pattern, normalizeFlags(flags))
  } catch {
    return { ok: false, error: INVALID_REGEX }
  }

  const source = textTruncated ? text.slice(0, REGEX_MAX_CHARS) : text
  const matches: RegexMatch[] = []
  re.lastIndex = 0

  if (re.global) {
    let match: RegExpExecArray | null
    while ((match = re.exec(source)) !== null) {
      matches.push(toMatch(match))
      if (re.lastIndex === match.index) re.lastIndex = match.index + 1
      if (matches.length >= limit) break
    }
  } else {
    const match = re.exec(source)
    if (match) matches.push(toMatch(match))
  }

  return {
    ok: true,
    matches,
    truncated: matches.length >= limit,
    textTruncated,
  }
}

export function highlightSegments(
  text: string,
  matches: readonly RegexMatch[],
  maxChars = REGEX_HIGHLIGHT_CHARS,
): { segments: HighlightSegment[]; truncated: boolean } {
  const truncated = text.length > maxChars
  const source = truncated ? text.slice(0, maxChars) : text
  const segments: HighlightSegment[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.index >= source.length) break
    if (match.index > cursor) {
      segments.push({ text: source.slice(cursor, match.index), matched: false })
    }
    const end = Math.min(match.index + match.match.length, source.length)
    if (end > match.index) {
      segments.push({ text: source.slice(match.index, end), matched: true })
    }
    cursor = Math.max(cursor, end)
    if (end < match.index + match.match.length) break
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor), matched: false })
  return { segments, truncated }
}

function toMatch(match: RegExpExecArray): RegexMatch {
  const groups = match.slice(1).map((group) => group ?? '')
  const named = match.groups
  return {
    match: match[0],
    index: match.index,
    groups,
    ...(named && Object.keys(named).length > 0 ? { namedGroups: { ...named } } : {}),
  }
}
