import { afterEach, describe, expect, it } from 'vitest'
import { HtmlParseError, processHtml, resetHtmlFormatter } from './html-utils'

afterEach(() => {
  resetHtmlFormatter()
  delete (globalThis as { HTML_FORMATTER_RAN?: boolean }).HTML_FORMATTER_RAN
})

describe('HTML formatter', () => {
  it('pretty-prints nested HTML with 2 spaces, 4 spaces, and tabs', async () => {
    const input = '<section><div><p>Hi</p><ul><li>A</li><li>B</li></ul></div></section>'
    expect(await processHtml(input, 'format', { indent: '2', printWidth: 80 })).toBe(
      '<section>\n  <div>\n    <p>Hi</p>\n    <ul>\n      <li>A</li>\n      <li>B</li>\n    </ul>\n  </div>\n</section>\n',
    )
    expect(await processHtml(input, 'format', { indent: '4', printWidth: 80 })).toBe(
      '<section>\n    <div>\n        <p>Hi</p>\n        <ul>\n            <li>A</li>\n            <li>B</li>\n        </ul>\n    </div>\n</section>\n',
    )
    expect(await processHtml(input, 'format', { indent: 'tab', printWidth: 80 })).toBe(
      '<section>\n\t<div>\n\t\t<p>Hi</p>\n\t\t<ul>\n\t\t\t<li>A</li>\n\t\t\t<li>B</li>\n\t\t</ul>\n\t</div>\n</section>\n',
    )
  })

  it('keeps script and style content as text and never executes it', async () => {
    const input = '<div><script>globalThis.HTML_FORMATTER_RAN=true</script><style>.x{color:red}</style><p>Hi</p></div>'
    const output = await processHtml(input, 'format')
    expect(output).toContain('globalThis.HTML_FORMATTER_RAN=true')
    expect(output).toContain('.x{color:red}')
    expect(output).toContain('<p>Hi</p>')
    expect((globalThis as { HTML_FORMATTER_RAN?: boolean }).HTML_FORMATTER_RAN).toBeUndefined()
  })

  it('preserves modern HTML syntax', async () => {
    const input = '<main><article data-id="1"><img src="x.webp"><input type="text" disabled><template><slot name="x"></slot></template></article></main>'
    const output = await processHtml(input, 'format')
    expect(output).toContain('<main>')
    expect(output).toContain('data-id="1"')
    expect(output).toContain('<img src="x.webp"')
    expect(output).toContain('<input type="text" disabled')
    expect(output).toMatch(/<template\b/)
    expect(output).toMatch(/<slot\b[^>]*name="x"/)
  })

  it('honors print width when wrapping long text', async () => {
    const input = '<div><p>Hello world this is a long sentence that should wrap</p></div>'
    expect(await processHtml(input, 'format', { indent: '2', printWidth: 40 })).toBe(
      '<div>\n  <p>\n    Hello world this is a long sentence\n    that should wrap\n  </p>\n</div>\n',
    )
  })

  it('minifies HTML without executing scripts or dropping structure', async () => {
    const input = '<section>\n  <script>alert(1)</script>\n  <div>\n    <p>Hi</p>\n    <ul><li>A</li><li>B</li></ul>\n  </div>\n</section>'
    expect(await processHtml(input, 'minify')).toBe(
      '<section><script>alert(1)</script><div><p>Hi</p><ul><li>A</li><li>B</li></ul></div></section>',
    )
    expect((globalThis as { HTML_FORMATTER_RAN?: boolean }).HTML_FORMATTER_RAN).toBeUndefined()
  })

  it('rejects malformed HTML with a line-aware parse error', async () => {
    await expect(processHtml('   ', 'format')).rejects.toThrow('Enter HTML to format.')
    await expect(processHtml('<div></span>', 'format')).rejects.toBeInstanceOf(HtmlParseError)
    await expect(processHtml('<div></span>', 'format')).rejects.toThrow(/Invalid HTML on line 1, column 6/)
    await expect(processHtml('<ul><li></div></li></ul>', 'format')).rejects.toThrow(/Unexpected closing tag/i)
  })
})
