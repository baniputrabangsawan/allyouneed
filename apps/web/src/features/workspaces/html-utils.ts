export type HtmlAction = 'format' | 'minify'
export type HtmlIndent = '2' | '4' | 'tab'

export interface HtmlFormatOptions {
  indent: HtmlIndent
  printWidth: number
}

export const HTML_MAX_CHARS = 2_000_000
export const HTML_YIELD_THRESHOLD = 80_000
export const DEFAULT_HTML_FORMAT_OPTIONS: HtmlFormatOptions = {
  indent: '2',
  printWidth: 80,
}

export class HtmlParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HtmlParseError'
  }
}

interface PrettierBundle {
  format: (source: string, options: Record<string, unknown>) => Promise<string>
  plugins: unknown[]
}

let prettierLoader: Promise<PrettierBundle> | undefined

export function resetHtmlFormatter(): void {
  prettierLoader = undefined
}

export async function loadHtmlFormatter(): Promise<PrettierBundle> {
  prettierLoader ??= Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/html'),
  ]).then(([prettier, html]) => ({
    format: prettier.format,
    plugins: [pluginFromModule(html)],
  }))
  return prettierLoader
}

export async function processHtml(
  input: string,
  action: HtmlAction,
  options: HtmlFormatOptions = DEFAULT_HTML_FORMAT_OPTIONS,
): Promise<string> {
  const source = stripBom(input)
  if (!source.trim()) throw new HtmlParseError('Enter HTML to format.')
  if (source.length > HTML_MAX_CHARS) {
    throw new HtmlParseError(`HTML is too large to process in the browser (max ${HTML_MAX_CHARS.toLocaleString()} characters).`)
  }
  const prettier = await loadHtmlFormatter()
  const printWidth = action === 'minify' ? Number.POSITIVE_INFINITY : clampPrintWidth(options.printWidth)
  try {
    const formatted = await prettier.format(source, {
      parser: 'html',
      plugins: prettier.plugins,
      printWidth,
      tabWidth: options.indent === 'tab' ? 2 : Number(options.indent),
      ...(options.indent === 'tab' ? { useTabs: true } : {}),
      embeddedLanguageFormatting: 'off',
    })
    return action === 'minify' ? minifyHtml(formatted) : formatted
  } catch (reason) {
    throw toHtmlParseError(reason)
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

function minifyHtml(formatted: string): string {
  return formatted
    .replace(/>\s+</gu, '><')
    .replace(/<(script|style)\b([^>]*)>\s+/giu, '<$1$2>')
    .replace(/\s+<\/(script|style)>/giu, '</$1>')
    .trim()
}

function clampPrintWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HTML_FORMAT_OPTIONS.printWidth
  return Math.min(1000, Math.max(1, Math.round(value)))
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value
}

function toHtmlParseError(reason: unknown): HtmlParseError {
  const message = reason instanceof Error ? reason.message : 'Invalid HTML.'
  const firstLine = message.split('\n')[0]?.trim() || 'Invalid HTML.'
  const loc = readErrorLocation(reason)
  if (loc) {
    return new HtmlParseError(`Invalid HTML on line ${loc.line}, column ${loc.column}. ${stripLocationSuffix(firstLine)}`)
  }
  return new HtmlParseError(firstLine)
}

function readErrorLocation(reason: unknown): { line: number; column: number } | undefined {
  if (!reason || typeof reason !== 'object') return undefined
  const loc = (reason as { loc?: { start?: { line?: number; column?: number } } }).loc?.start
  if (typeof loc?.line === 'number' && loc.line >= 1) {
    return { line: loc.line, column: Math.max(1, loc.column ?? 1) }
  }
  const match = (reason instanceof Error ? reason.message : '').match(/\((\d+):(\d+)\)/u)
  if (!match) return undefined
  return { line: Number(match[1]), column: Number(match[2]) }
}

function stripLocationSuffix(message: string): string {
  return message.replace(/\s*\(\d+:\d+\)\s*$/u, '').trim()
}

function pluginFromModule(mod: { default?: unknown }): unknown {
  return mod.default ?? mod
}
