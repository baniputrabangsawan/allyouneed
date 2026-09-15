import Papa from 'papaparse'

export type CsvDelimiter = 'auto' | ',' | ';' | '\t'

export interface CsvToJsonOptions {
  delimiter: CsvDelimiter
  header: boolean
}

export interface CsvJsonResult {
  text: string
  preview: string[][]
}

const delimiters = [',', ';', '\t']

export function csvToJson(input: string, options: CsvToJsonOptions): CsvJsonResult {
  const delimiter = options.delimiter === 'auto' ? '' : options.delimiter
  const parsed = Papa.parse<Record<string, unknown> | string[]>(input, {
    delimiter,
    header: options.header,
    skipEmptyLines: 'greedy',
  })
  if (parsed.errors.length) throw new Error(parsed.errors[0]?.message || 'The CSV could not be parsed.')
  return {
    text: JSON.stringify(parsed.data, null, 2),
    preview: previewRows(parsed.data),
  }
}

export function jsonToCsv(input: string, delimiter: Exclude<CsvDelimiter, 'auto'> = ','): CsvJsonResult {
  let value: unknown
  try {
    value = JSON.parse(input)
  } catch (error) {
    try {
      value = JSON.parse(escapeControlCharactersInJsonStrings(input))
    } catch {
      throw new Error(error instanceof Error ? error.message : 'The JSON could not be parsed.')
    }
  }
  if (!Array.isArray(value) || !value.every(isRecord)) throw new Error('JSON input must be an array of objects.')
  const fields = [...new Set(value.flatMap((row) => Object.keys(row)))]
  const text = Papa.unparse(value, { columns: fields, delimiter })
  return { text, preview: [fields, ...value.slice(0, 4).map((row) => fields.map((field) => stringifyCell(row[field])))] }
}

function escapeControlCharactersInJsonStrings(input: string): string {
  let output = ''
  let quoted = false
  let escaped = false
  for (const char of input) {
    if (escaped) {
      output += char
      escaped = false
    } else if (char === '\\') {
      output += char
      escaped = true
    } else if (char === '"') {
      output += char
      quoted = !quoted
    } else if (quoted && char === '\n') output += '\\n'
    else if (quoted && char === '\r') output += '\\r'
    else if (quoted && char === '\t') output += '\\t'
    else output += char
  }
  return output
}

export function detectedDelimiter(input: string): Exclude<CsvDelimiter, 'auto'> {
  const sample = input.slice(0, 4096)
  return delimiters.map((delimiter) => ({ delimiter, count: countOutsideQuotes(sample, delimiter) })).sort((a, b) => b.count - a.count)[0]?.delimiter as Exclude<CsvDelimiter, 'auto'>
}

function previewRows(data: Array<Record<string, unknown> | string[]>): string[][] {
  if (!data.length) return []
  const first = data[0]
  if (Array.isArray(first)) return (data as string[][]).slice(0, 5).map((row) => row.map(stringifyCell))
  if (!first) return []
  const fields = Object.keys(first)
  return [fields, ...(data as Record<string, unknown>[]).slice(0, 4).map((row) => fields.map((field) => stringifyCell(row[field])))]
}

function stringifyCell(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function countOutsideQuotes(input: string, needle: string): number {
  let count = 0
  let quoted = false
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] === '"') {
      if (quoted && input[i + 1] === '"') i += 1
      else quoted = !quoted
    } else if (!quoted && input[i] === needle) count += 1
  }
  return count
}
