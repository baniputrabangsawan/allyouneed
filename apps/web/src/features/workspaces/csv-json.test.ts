import { describe, expect, it } from 'vitest'
import { csvToJson, detectedDelimiter, jsonToCsv } from './csv-json'

describe('CSV JSON converter', () => {
  it('converts CSV with headers to JSON', () => {
    expect(csvToJson('name,age\nJohn,25', { delimiter: ',', header: true }).text).toBe('[\n  {\n    "name": "John",\n    "age": "25"\n  }\n]')
  })

  it('preserves commas, quotes, and multiline values in CSV', () => {
    const result = csvToJson('name,note\n"Doe, Jane","hello ""friend""\nnext line"', { delimiter: ',', header: true })
    expect(JSON.parse(result.text)).toEqual([{ name: 'Doe, Jane', note: 'hello "friend"\nnext line' }])
  })

  it('supports semicolon and tab delimiters', () => {
    expect(JSON.parse(csvToJson('name;age\nAna;31', { delimiter: ';', header: true }).text)).toEqual([{ name: 'Ana', age: '31' }])
    expect(JSON.parse(csvToJson('name\tage\nAna\t31', { delimiter: '\t', header: true }).text)).toEqual([{ name: 'Ana', age: '31' }])
  })

  it('auto-detects reliable delimiters outside quoted values', () => {
    expect(detectedDelimiter('name;note\nAna;"one,two"')).toBe(';')
  })

  it('converts JSON object arrays to escaped CSV', () => {
    expect(jsonToCsv('[{"name":"John","note":"hello, world\nagain"}]').text).toBe('name,note\r\nJohn,"hello, world\nagain"')
  })

  it('rejects non-object JSON arrays', () => {
    expect(() => jsonToCsv('[1,2]')).toThrow('array of objects')
  })
})
