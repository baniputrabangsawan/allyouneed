import { beforeAll, describe, expect, it } from 'vitest'
import { installTestDomParser } from './xml-test-dom'
import { parseXml, processXml, XmlParseError } from './xml-utils'

beforeAll(() => {
  installTestDomParser()
})

describe('XML formatter', () => {
  it('pretty-prints valid XML with configurable indentation', () => {
    const input = '<root><item>Hi</item><item>There</item></root>'
    expect(processXml(input, 'format', '2')).toBe('<root>\n  <item>Hi</item>\n  <item>There</item>\n</root>')
    expect(processXml(input, 'format', '4')).toBe('<root>\n    <item>Hi</item>\n    <item>There</item>\n</root>')
    expect(processXml(input, 'format', 'tab')).toBe('<root>\n\t<item>Hi</item>\n\t<item>There</item>\n</root>')
  })

  it('validates well-formed XML and rejects invalid XML with line context', () => {
    expect(processXml('<root><item>Hi</item></root>', 'validate')).toBe('Valid XML')
    expect(() => processXml('<root><item></root>', 'validate')).toThrow(XmlParseError)
    try {
      processXml('<root>\n  <item>\n</root>', 'format')
      throw new Error('expected invalid XML')
    } catch (reason) {
      expect(reason).toBeInstanceOf(XmlParseError)
      expect((reason as Error).message).toMatch(/line 3/i)
      expect((reason as Error).message).toMatch(/<\/root>/)
    }
  })

  it('preserves namespaces and attributes', () => {
    const input = '<a:root xmlns:a="http://example.com/a" a:id="1"><a:child b="keep">x</a:child></a:root>'
    expect(processXml(input, 'format', '2')).toBe(
      '<a:root xmlns:a="http://example.com/a" a:id="1">\n  <a:child b="keep">x</a:child>\n</a:root>',
    )
  })

  it('preserves CDATA sections', () => {
    expect(processXml('<root><![CDATA[1 < 2 & 3]]></root>', 'format')).toBe('<root><![CDATA[1 < 2 & 3]]></root>')
    expect(processXml('<root><a/><![CDATA[keep]]></root>', 'minify')).toBe('<root><a/><![CDATA[keep]]></root>')
  })

  it('minifies XML without executing content or dropping structure', () => {
    const input = '<?xml version="1.0"?>\n<root>\n  <script>alert(1)</script>\n  <item a="1">Hi</item>\n</root>'
    expect(processXml(input, 'minify')).toBe('<?xml version="1.0"?><root><script>alert(1)</script><item a="1">Hi</item></root>')
  })

  it('keeps meaningful mixed-content whitespace', () => {
    expect(processXml('<p>Hello <em>world</em>!</p>', 'format')).toBe('<p>Hello <em>world</em>!</p>')
    expect(processXml('<pre xml:space="preserve">\n  keep\n</pre>', 'format')).toBe('<pre xml:space="preserve">\n  keep\n</pre>')
  })

  it('does not treat a real parsererror element as a parse failure', () => {
    expect(parseXml('<parsererror>literal</parsererror>').documentElement?.localName).toBe('parsererror')
  })
})
