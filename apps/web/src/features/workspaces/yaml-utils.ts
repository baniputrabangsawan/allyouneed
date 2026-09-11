import { parseDocument, stringify, YAMLParseError } from 'yaml'

export const YAML_MAX_CHARS = 2_000_000

const yamlOptions = {
  schema: 'core' as const,
  prettyErrors: true,
  // Core YAML 1.2 only: maps, seqs, strings, numbers, bools, null.
  // No JS/Python tags, no merge keys, no 1.1 binary/timestamp helpers.
  customTags: null,
  merge: false,
  resolveKnownTags: false,
}

/**
 * Anchors and aliases: `parseDocument` / `toJS()` expand `*alias` into the
 * referenced value, so JSON output never contains anchors. YAML 1.2 Core does
 * not apply YAML 1.1 merge keys (`<<`); those stay ordinary keys.
 * The parser's default `maxAliasCount` (100) rejects alias-bomb documents.
 * Unresolved tags (including `!!js/function`) are errors. Nothing is executed.
 */
export class YamlConversionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'YamlConversionError'
  }
}

export function yamlToJson(input: string): string {
  const source = prepareInput(input, 'YAML')
  let value: unknown
  try {
    const document = parseDocument(source, { ...yamlOptions, logLevel: 'silent' })
    const problem = document.errors[0] ?? document.warnings.find((warning) => warning.code === 'TAG_RESOLVE_FAILED')
    if (problem) throw problem
    value = document.toJS()
  } catch (reason) {
    throw wrapYamlError(reason)
  }
  return JSON.stringify(value ?? null, null, 2)
}

export function jsonToYaml(input: string): string {
  const source = prepareInput(input, 'JSON')
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch (reason) {
    throw wrapJsonError(reason)
  }
  try {
    return stringify(value, { ...yamlOptions, indent: 2 })
  } catch (reason) {
    throw wrapYamlError(reason)
  }
}

function prepareInput(input: string, kind: 'YAML' | 'JSON'): string {
  const source = stripBom(input)
  if (!source.trim()) throw new YamlConversionError(`Enter ${kind} to convert.`)
  if (source.length > YAML_MAX_CHARS) {
    throw new YamlConversionError(
      `${kind} is too large to process in the browser (max ${YAML_MAX_CHARS.toLocaleString()} characters).`,
    )
  }
  return source
}

function wrapYamlError(reason: unknown): YamlConversionError {
  if (reason instanceof YamlConversionError) return reason
  const detail = reason instanceof YAMLParseError || reason instanceof Error
    ? reason.message
    : 'The YAML could not be parsed.'
  return new YamlConversionError(`Invalid YAML: ${detail}`)
}

function wrapJsonError(reason: unknown): YamlConversionError {
  const detail = reason instanceof Error ? reason.message : 'The JSON could not be parsed.'
  return new YamlConversionError(`Invalid JSON: ${detail}`)
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value
}
