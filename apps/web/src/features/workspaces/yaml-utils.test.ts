import { describe, expect, it } from 'vitest'
import { jsonToYaml, yamlToJson, YamlConversionError, YAML_MAX_CHARS } from './yaml-utils'

const nestedYaml = `
project:
  name: Kits
  tools:
    - yaml
    - json
  enabled: true
  count: 2
  extra: null
`.trim()

const nestedJson = `{
  "project": {
    "name": "Kits",
    "tools": [
      "yaml",
      "json"
    ],
    "enabled": true,
    "count": 2,
    "extra": null
  }
}`

describe('YAML to JSON', () => {
  it('converts nested maps, arrays, and scalars', () => {
    expect(JSON.parse(yamlToJson(nestedYaml))).toEqual(JSON.parse(nestedJson))
    expect(yamlToJson(nestedYaml)).toBe(nestedJson)
  })

  it('preserves Unicode strings', () => {
    expect(JSON.parse(yamlToJson('greeting: こんにちは\nemoji: 🎉'))).toEqual({
      greeting: 'こんにちは',
      emoji: '🎉',
    })
  })

  it('expands anchors and aliases into duplicated JSON values', () => {
    const json = JSON.parse(yamlToJson('foo: &id\n  name: Kits\nbar: *id'))
    expect(json).toEqual({ foo: { name: 'Kits' }, bar: { name: 'Kits' } })
    expect(json.foo).toEqual(json.bar)
  })

  it('treats YAML 1.1 merge keys as ordinary keys under Core schema', () => {
    const json = JSON.parse(yamlToJson('defaults: &defaults\n  a: 1\nmerged:\n  <<: *defaults\n  b: 2'))
    expect(json.merged).toEqual({ '<<': { a: 1 }, b: 2 })
    expect(json.merged).not.toHaveProperty('a')
  })

  it('rejects invalid YAML with a parse error', () => {
    expect(() => yamlToJson('foo: [')).toThrow(YamlConversionError)
    expect(() => yamlToJson('foo: [')).toThrow(/Invalid YAML/i)
  })

  it('rejects empty input', () => {
    expect(() => yamlToJson('')).toThrow('Enter YAML to convert.')
    expect(() => yamlToJson('   \n')).toThrow('Enter YAML to convert.')
  })

  it('rejects custom executable tags without running them', () => {
    expect(() => yamlToJson('evil: !!js/function "function () { return 1 }"')).toThrow(YamlConversionError)
    expect(() => yamlToJson('evil: !!python/object:foo.Bar {}')).toThrow(YamlConversionError)
  })
})

describe('JSON to YAML', () => {
  it('serializes nested JSON as YAML', () => {
    const yaml = jsonToYaml(nestedJson)
    expect(JSON.parse(yamlToJson(yaml))).toEqual(JSON.parse(nestedJson))
    expect(yaml).toMatch(/project:/)
    expect(yaml).toMatch(/name: Kits/)
    expect(yaml).toMatch(/- yaml/)
  })

  it('preserves Unicode strings', () => {
    const yaml = jsonToYaml('{"greeting":"こんにちは","emoji":"🎉"}')
    expect(JSON.parse(yamlToJson(yaml))).toEqual({ greeting: 'こんにちは', emoji: '🎉' })
  })

  it('rejects invalid JSON with a parse error', () => {
    expect(() => jsonToYaml('{foo}')).toThrow(YamlConversionError)
    expect(() => jsonToYaml('{foo}')).toThrow(/Invalid JSON/i)
  })

  it('rejects empty input', () => {
    expect(() => jsonToYaml('')).toThrow('Enter JSON to convert.')
  })
})

describe('shared conversion limits', () => {
  it('rejects oversized input', () => {
    const huge = `k: ${'x'.repeat(YAML_MAX_CHARS)}`
    expect(() => yamlToJson(huge)).toThrow(/too large/)
  })
})
