import { describe, expect, it } from 'vitest'
import {
  diffJsonText,
  formatDiffReport,
  formatJson,
  formatJsonPath,
  JSON_MAX_ENTRIES,
  type JsonDiffResult,
} from './json-diff'
describe('formatJsonPath', () => {
  it('builds object, array, and mixed paths', () => {
    expect(formatJsonPath([])).toBe('(root)')
    expect(formatJsonPath(['user', 'name'])).toBe('user.name')
    expect(formatJsonPath(['settings', 'theme'])).toBe('settings.theme')
    expect(formatJsonPath(['items', 2, 'price'])).toBe('items[2].price')
    expect(formatJsonPath(['weird.key', 'x'])).toBe('["weird.key"].x')
  })
})

describe('formatJson', () => {
  it('pretty-prints valid JSON and rejects invalid input', () => {
    expect(formatJson('{"ok":true}')).toBe('{\n  "ok": true\n}')
    expect(() => formatJson('{bad}')).toThrow(SyntaxError)
  })
})

describe('diffJsonText', () => {
  it('classifies added, removed, changed, and unchanged paths', () => {
    const result = diffJsonText(
      '{"user":{"name":"Ada","age":20},"settings":{"theme":"light"},"items":[{"price":1},{"price":2},{"price":10}]}',
      '{"user":{"name":"Ada","email":"a@x.com"},"settings":{"theme":"dark"},"items":[{"price":1},{"price":2},{"price":12}]}',
    )
    expect(byPath(result, 'user.name')).toMatchObject({ kind: 'unchanged', left: '"Ada"' })
    expect(byPath(result, 'user.age')).toMatchObject({ kind: 'removed', left: '20' })
    expect(byPath(result, 'user.email')).toMatchObject({ kind: 'added', right: '"a@x.com"' })
    expect(byPath(result, 'settings.theme')).toMatchObject({ kind: 'changed', left: '"light"', right: '"dark"' })
    expect(byPath(result, 'items[2].price')).toMatchObject({ kind: 'changed', left: '10', right: '12' })
    expect(result.counts).toEqual({ added: 1, removed: 1, changed: 2, unchanged: 3 })
  })

  it('treats array order as meaningful', () => {
    const result = diffJsonText('[1,2,3]', '[1,3,2]')
    expect(byPath(result, '[0]')).toMatchObject({ kind: 'unchanged', left: '1' })
    expect(byPath(result, '[1]')).toMatchObject({ kind: 'changed', left: '2', right: '3' })
    expect(byPath(result, '[2]')).toMatchObject({ kind: 'changed', left: '3', right: '2' })
  })

  it('ignores object key order unless the toggle is off', () => {
    const left = '{"b":1,"a":2}'
    const right = '{"a":2,"b":1}'
    const ignored = diffJsonText(left, right)
    expect(ignored.entries).toEqual([
      expect.objectContaining({ path: '(root)', kind: 'unchanged' }),
    ])
    const ordered = diffJsonText(left, right, { ignoreKeyOrder: false })
    expect(byPath(ordered, '(root)')).toMatchObject({ kind: 'changed', left: '["b","a"]', right: '["a","b"]' })
    expect(byPath(ordered, 'b')).toMatchObject({ kind: 'unchanged' })
    expect(byPath(ordered, 'a')).toMatchObject({ kind: 'unchanged' })
  })

  it('collapses identical subtrees and reports type changes at that path', () => {
    const same = diffJsonText('{"nested":{"ok":true}}', '{"nested":{"ok":true}}')
    expect(same.entries).toEqual([expect.objectContaining({ path: '(root)', kind: 'unchanged' })])
    const typeChange = diffJsonText('{"items":[1]}', '{"items":{"0":1}}')
    expect(byPath(typeChange, 'items')).toMatchObject({ kind: 'changed' })
  })

  it('returns parse errors for each invalid side without a diff', () => {
    const result = diffJsonText('{bad', '[1,]')
    expect(result.entries).toEqual([])
    expect(result.leftError).toMatch(/JSON/i)
    expect(result.rightError).toBeDefined()
  })

  it('treats a blank side as empty when the other has JSON', () => {
    const result = diffJsonText('', '{"a":1}')
    expect(result.leftError).toBe('JSON A is empty.')
    expect(result.entries).toEqual([])
  })

  it('formats a copyable report with status words, not color', () => {
    const result = diffJsonText('{"a":1,"keep":true}', '{"a":2,"keep":true}')
    const report = formatDiffReport(result)
    expect(report).toContain('~ Changed   a  1 → 2')
    expect(report).toContain('0 added, 0 removed, 1 changed, 1 unchanged')
  })

  it('caps extremely wide object diffs', () => {
    const left: Record<string, number> = {}
    const right: Record<string, number> = {}
    for (let index = 0; index < JSON_MAX_ENTRIES + 20; index += 1) {
      left[`k${index}`] = index
      right[`k${index}`] = index + 1
    }
    const result = diffJsonText(JSON.stringify(left), JSON.stringify(right))
    expect(result.truncated).toBe(true)
    expect(result.entries.length).toBe(JSON_MAX_ENTRIES)
  })
})
function byPath(result: JsonDiffResult, path: string) {
  return result.entries.find((entry) => entry.path === path)
}
