import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_JS_FORMAT_OPTIONS,
  formatJavaScript,
  JsParseError,
  resetJavaScriptFormatter,
} from './javascript-utils'

afterEach(() => {
  resetJavaScriptFormatter()
  delete (globalThis as { JS_FORMATTER_RAN?: boolean }).JS_FORMATTER_RAN
})

describe('JavaScript formatter', () => {
  it('formats function declarations without evaluating them', async () => {
    const output = await formatJavaScript('function greet(name){return "hi "+name}')
    expect(output).toBe('function greet(name) {\n  return "hi " + name;\n}\n')
    expect((globalThis as { JS_FORMATTER_RAN?: boolean }).JS_FORMATTER_RAN).toBeUndefined()
  })

  it('formats async syntax', async () => {
    const output = await formatJavaScript('async function load(id){const value=await fetch(id);return value}')
    expect(output).toBe('async function load(id) {\n  const value = await fetch(id);\n  return value;\n}\n')
  })

  it('honors semicolons, quotes, tab width, and trailing commas', async () => {
    const source = 'const pack={items:["a","b"],run:async()=>{return 1}}'
    expect(await formatJavaScript(source, {
      ...DEFAULT_JS_FORMAT_OPTIONS,
      semi: false,
      singleQuote: true,
      tabWidth: 4,
      trailingComma: 'none',
    })).toBe("const pack = {\n    items: ['a', 'b'],\n    run: async () => {\n        return 1\n    }\n}\n")
  })

  it('rejects invalid source with a parser error', async () => {
    await expect(formatJavaScript('function ({\n')).rejects.toBeInstanceOf(JsParseError)
    await expect(formatJavaScript('function ({\n')).rejects.toThrow(/Invalid JavaScript/i)
    await expect(formatJavaScript('   ')).rejects.toThrow('Enter JavaScript to format.')
  })

  it('parses and formats only, never executing submitted JavaScript', async () => {
    const output = await formatJavaScript('globalThis.JS_FORMATTER_RAN=true;throw new Error("should not run")')
    expect(output).toBe('globalThis.JS_FORMATTER_RAN = true;\nthrow new Error("should not run");\n')
    expect((globalThis as { JS_FORMATTER_RAN?: boolean }).JS_FORMATTER_RAN).toBeUndefined()
  })
})
