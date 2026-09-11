export type JsTrailingComma = 'none' | 'es5' | 'all'
export type JsTabWidth = 2 | 4

export interface JsFormatOptions {
  semi: boolean
  singleQuote: boolean
  tabWidth: JsTabWidth
  trailingComma: JsTrailingComma
  useTabs?: boolean
}

export const JS_MAX_CHARS = 2_000_000
export const JS_YIELD_THRESHOLD = 80_000
export const DEFAULT_JS_FORMAT_OPTIONS: JsFormatOptions = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: 'all',
}

export class JsParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JsParseError'
  }
}

interface PrettierBundle {
  format: (source: string, options: Record<string, unknown>) => Promise<string>
  plugins: unknown[]
}

let prettierLoader: Promise<PrettierBundle> | undefined

export function resetJavaScriptFormatter(): void {
  prettierLoader = undefined
}

export async function loadJavaScriptFormatter(): Promise<PrettierBundle> {
  prettierLoader ??= Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]).then(([prettier, babel, estree]) => ({
    format: prettier.format,
    plugins: [pluginFromModule(babel), pluginFromModule(estree)],
  }))
  return prettierLoader
}

export async function formatJavaScript(input: string, options: JsFormatOptions = DEFAULT_JS_FORMAT_OPTIONS): Promise<string> {
  const source = input.replace(/^﻿/, '')
  if (!source.trim()) throw new JsParseError('Enter JavaScript to format.')
  if (source.length > JS_MAX_CHARS) {
    throw new JsParseError(`JavaScript is too large to process in the browser (max ${JS_MAX_CHARS.toLocaleString()} characters).`)
  }
  const prettier = await loadJavaScriptFormatter()
  try {
    return await prettier.format(source, {
      parser: 'babel',
      plugins: prettier.plugins,
      semi: options.semi,
      singleQuote: options.singleQuote,
      tabWidth: options.tabWidth,
      trailingComma: options.trailingComma,
      ...(options.useTabs ? { useTabs: true } : {}),
    })
  } catch (reason) {
    throw toJsParseError(reason)
  }
}

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    const scheduler = (globalThis as { scheduler?: { postTask?: (task: () => void) => Promise<unknown> } }).scheduler
    if (scheduler?.postTask) {
      void scheduler.postTask(() => resolve())
      return
    }
    if (typeof globalThis.setTimeout === 'function') {
      globalThis.setTimeout(resolve, 0)
      return
    }
    resolve()
  })
}

function toJsParseError(reason: unknown): JsParseError {
  const message = reason instanceof Error ? reason.message : 'Invalid JavaScript.'
  const loc = readErrorLocation(reason)
  if (loc) {
    return new JsParseError(`Invalid JavaScript on line ${loc.line}, column ${loc.column}. ${stripLocationSuffix(message)}`)
  }
  return new JsParseError(message)
}

function readErrorLocation(reason: unknown): { line: number; column: number } | undefined {
  if (!reason || typeof reason !== 'object') return undefined
  const loc = (reason as { loc?: { start?: { line?: number; column?: number } } }).loc?.start
  if (typeof loc?.line === 'number' && loc.line >= 1) {
    return { line: loc.line, column: Math.max(1, (loc.column ?? 0) + 1) }
  }
  const match = (reason instanceof Error ? reason.message : '').match(/\((\d+):(\d+)\)\s*$/u)
  if (!match) return undefined
  return { line: Number(match[1]), column: Number(match[2]) + 1 }
}

function stripLocationSuffix(message: string): string {
  return message.replace(/\s*\(\d+:\d+\)\s*$/u, '').trim()
}

function pluginFromModule(mod: { default?: unknown }): unknown {
  return mod.default ?? mod
}
