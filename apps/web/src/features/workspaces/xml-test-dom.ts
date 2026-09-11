const ELEMENT_NODE = 1
const TEXT_NODE = 3
const CDATA_SECTION_NODE = 4
const PROCESSING_INSTRUCTION_NODE = 7
const COMMENT_NODE = 8
const DOCUMENT_NODE = 9
const DOCUMENT_TYPE_NODE = 10
const XML_NS = 'http://www.w3.org/XML/1998/namespace'
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/'
const PARSERERROR_NS = 'http://www.mozilla.org/newlayout/xml/parsererror.xml'

class MiniNodeList<T> {
  readonly length: number
  constructor(private readonly nodes: T[]) {
    this.length = nodes.length
  }
  item(index: number): T | null { return this.nodes[index] ?? null }
}

class MiniNamedNodeMap {
  readonly length: number
  constructor(private readonly nodes: MiniAttr[]) {
    this.length = nodes.length
  }
  item(index: number): MiniAttr | null { return this.nodes[index] ?? null }
}

class MiniNode {
  parentNode: MiniNode | null = null
  constructor(readonly nodeType: number) {}
  get parentElement(): MiniElement | null {
    return this.parentNode instanceof MiniElement ? this.parentNode : null
  }
}

class MiniCharacterData extends MiniNode {
  constructor(nodeType: number, public data: string) { super(nodeType) }
  get textContent(): string { return this.data }
}

class MiniText extends MiniCharacterData { constructor(data: string) { super(TEXT_NODE, data) } }
class MiniCdata extends MiniCharacterData { constructor(data: string) { super(CDATA_SECTION_NODE, data) } }
class MiniComment extends MiniCharacterData { constructor(data: string) { super(COMMENT_NODE, data) } }

class MiniAttr {
  constructor(
    readonly name: string,
    readonly value: string,
    readonly namespaceURI: string | null,
    readonly localName: string,
  ) {}
}

class MiniPi extends MiniNode {
  constructor(readonly target: string, readonly data: string) { super(PROCESSING_INSTRUCTION_NODE) }
}

class MiniDoctype extends MiniNode {
  constructor(readonly name: string, readonly publicId: string, readonly systemId: string) { super(DOCUMENT_TYPE_NODE) }
}

class MiniElement extends MiniNode {
  constructor(
    readonly tagName: string,
    readonly namespaceURI: string | null,
    readonly localName: string,
    readonly attributeNodes: MiniAttr[],
    readonly children: MiniNode[],
  ) {
    super(ELEMENT_NODE)
    for (const child of children) child.parentNode = this
  }
  get attributes(): MiniNamedNodeMap { return new MiniNamedNodeMap(this.attributeNodes) }
  get childNodes(): MiniNodeList<MiniNode> { return new MiniNodeList(this.children) }
  get textContent(): string {
    return this.children.map((child) => 'textContent' in child ? String((child as { textContent: string }).textContent) : '').join('')
  }
  getAttribute(name: string): string | null {
    return this.attributeNodes.find((attribute) => attribute.name === name)?.value ?? null
  }
  getAttributeNS(namespace: string | null, localName: string): string | null {
    return this.attributeNodes.find((attribute) => attribute.namespaceURI === namespace && attribute.localName === localName)?.value ?? null
  }
}

class MiniDocument extends MiniNode {
  constructor(readonly children: MiniNode[]) {
    super(DOCUMENT_NODE)
    for (const child of children) child.parentNode = this
  }
  get childNodes(): MiniNodeList<MiniNode> { return new MiniNodeList(this.children) }
  get documentElement(): MiniElement | null {
    return this.children.find((child): child is MiniElement => child instanceof MiniElement) ?? null
  }
  getElementsByTagName(name: string): MiniElement[] {
    return collect(this, (element) => name === '*' || element.tagName === name || element.localName === name)
  }
  getElementsByTagNameNS(namespace: string | null, localName: string): MiniElement[] {
    return collect(this, (element) => element.namespaceURI === namespace && element.localName === localName)
  }
}

function collect(root: MiniNode, match: (element: MiniElement) => boolean): MiniElement[] {
  const found: MiniElement[] = []
  const visit = (node: MiniNode) => {
    if (node instanceof MiniElement) {
      if (match(node)) found.push(node)
      for (const child of node.children) visit(child)
    } else if (node instanceof MiniDocument) {
      for (const child of node.children) visit(child)
    }
  }
  visit(root)
  return found
}

class XmlSyntaxError extends Error {
  constructor(readonly line: number, readonly column: number, message: string) {
    super(message)
  }
}

class Reader {
  pos = 0
  constructor(readonly source: string) {}
  eof(): boolean { return this.pos >= this.source.length }
  peek(count = 1): string { return this.source.slice(this.pos, this.pos + count) }
  startsWith(value: string): boolean { return this.source.startsWith(value, this.pos) }
  advance(count = 1): string {
    const value = this.source.slice(this.pos, this.pos + count)
    this.pos += count
    return value
  }
  locate(): { line: number; column: number } {
    const until = this.source.slice(0, this.pos)
    const lines = until.split(/\r\n|\n|\r/u)
    return { line: lines.length, column: (lines.at(-1) ?? '').length + 1 }
  }
  fail(message: string): never {
    const { line, column } = this.locate()
    throw new XmlSyntaxError(line, column, message)
  }
}

function decodeEntities(value: string, reader: Reader): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/gu, (match, body: string) => {
    if (body === 'lt') return '<'
    if (body === 'gt') return '>'
    if (body === 'amp') return '&'
    if (body === 'quot') return '"'
    if (body === 'apos') return "'"
    if (body.startsWith('#x')) return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
    if (body.startsWith('#')) return String.fromCodePoint(Number(body.slice(1)))
    reader.fail(`Unknown entity ${match}`)
  })
}

function isNameStart(character: string): boolean {
  return /[:A-Z_a-z]/u.test(character)
}

function readName(reader: Reader): string {
  if (!isNameStart(reader.peek())) reader.fail('Expected a name')
  let name = reader.advance()
  while (/[:A-Z_a-z.0-9-]/u.test(reader.peek())) name += reader.advance()
  return name
}

function skipWhitespace(reader: Reader) {
  while (/\s/u.test(reader.peek())) reader.advance()
}

function readUntil(reader: Reader, end: string): string {
  const start = reader.pos
  const index = reader.source.indexOf(end, reader.pos)
  if (index === -1) reader.fail(`Unterminated ${end}`)
  reader.pos = index + end.length
  return reader.source.slice(start, index)
}

function parseAttributes(reader: Reader, namespaces: Map<string, string>): MiniAttr[] {
  const attributes: MiniAttr[] = []
  const pending: { name: string; value: string }[] = []
  while (true) {
    skipWhitespace(reader)
    if (reader.peek() === '/' || reader.peek() === '>') break
    const name = readName(reader)
    skipWhitespace(reader)
    if (reader.advance() !== '=') reader.fail('Expected = in attribute')
    skipWhitespace(reader)
    const quote = reader.advance()
    if (quote !== '"' && quote !== "'") reader.fail('Expected a quoted attribute value')
    let value = ''
    while (!reader.eof() && reader.peek() !== quote) value += reader.advance()
    if (reader.advance() !== quote) reader.fail('Unterminated attribute value')
    pending.push({ name, value: decodeEntities(value, reader) })
  }
  const localNs = new Map(namespaces)
  for (const { name, value } of pending) {
    if (name === 'xmlns') localNs.set('', value)
    else if (name.startsWith('xmlns:')) localNs.set(name.slice(6), value)
  }
  for (const key of localNs.keys()) namespaces.set(key, localNs.get(key)!)
  for (const { name, value } of pending) {
    if (name === 'xmlns') attributes.push(new MiniAttr(name, value, XMLNS_NS, 'xmlns'))
    else if (name.startsWith('xmlns:')) attributes.push(new MiniAttr(name, value, XMLNS_NS, name.slice(6)))
    else if (name.startsWith('xml:')) attributes.push(new MiniAttr(name, value, XML_NS, name.slice(4)))
    else {
      const colon = name.indexOf(':')
      const prefix = colon === -1 ? '' : name.slice(0, colon)
      const localName = colon === -1 ? name : name.slice(colon + 1)
      attributes.push(new MiniAttr(name, value, prefix ? localNs.get(prefix) ?? null : null, localName))
    }
  }
  return attributes
}

function parseName(tagName: string, namespaces: Map<string, string>): { namespaceURI: string | null; localName: string } {
  const colon = tagName.indexOf(':')
  if (colon === -1) return { namespaceURI: namespaces.get('') ?? null, localName: tagName }
  return { namespaceURI: namespaces.get(tagName.slice(0, colon)) ?? null, localName: tagName.slice(colon + 1) }
}

function parseContent(reader: Reader, namespaces: Map<string, string>): MiniNode[] {
  const children: MiniNode[] = []
  while (!reader.eof()) {
    if (reader.startsWith('</')) break
    if (reader.startsWith('<![CDATA[')) {
      reader.advance(9)
      children.push(new MiniCdata(readUntil(reader, ']]>')))
      continue
    }
    if (reader.startsWith('<!--')) {
      reader.advance(4)
      children.push(new MiniComment(readUntil(reader, '-->')))
      continue
    }
    if (reader.startsWith('<?')) {
      children.push(parsePi(reader))
      continue
    }
    if (reader.startsWith('<')) {
      children.push(parseElement(reader, new Map(namespaces)))
      continue
    }
    let text = ''
    while (!reader.eof() && reader.peek() !== '<') text += reader.advance()
    children.push(new MiniText(decodeEntities(text, reader)))
  }
  return children
}

function parsePi(reader: Reader): MiniPi {
  reader.advance(2)
  const target = readName(reader)
  if (target.toLowerCase() === 'xml') reader.fail('XML declaration is only allowed at the start')
  skipWhitespace(reader)
  const data = readUntil(reader, '?>').trimEnd()
  return new MiniPi(target, data.trim())
}

function parseDoctype(reader: Reader): MiniDoctype {
  reader.advance(9)
  skipWhitespace(reader)
  const name = readName(reader)
  skipWhitespace(reader)
  let publicId = ''
  let systemId = ''
  if (reader.startsWith('PUBLIC')) {
    reader.advance(6); skipWhitespace(reader)
    const quote = reader.advance()
    publicId = readUntil(reader, quote)
    skipWhitespace(reader)
    const systemQuote = reader.advance()
    systemId = readUntil(reader, systemQuote)
  } else if (reader.startsWith('SYSTEM')) {
    reader.advance(6); skipWhitespace(reader)
    const quote = reader.advance()
    systemId = readUntil(reader, quote)
  }
  skipWhitespace(reader)
  if (reader.peek() === '[') reader.fail('Internal DTD subsets are not processed')
  if (reader.advance() !== '>') reader.fail('Unterminated DOCTYPE')
  return new MiniDoctype(name, publicId, systemId)
}

function parseElement(reader: Reader, namespaces: Map<string, string>): MiniElement {
  if (reader.advance() !== '<') reader.fail('Expected <')
  const tagName = readName(reader)
  const attributes = parseAttributes(reader, namespaces)
  const names = parseName(tagName, namespaces)
  skipWhitespace(reader)
  if (reader.startsWith('/>')) {
    reader.advance(2)
    return new MiniElement(tagName, names.namespaceURI, names.localName, attributes, [])
  }
  if (reader.advance() !== '>') reader.fail('Unterminated start tag')
  const children = parseContent(reader, namespaces)
  if (!reader.startsWith('</')) reader.fail(`Missing end tag for ${tagName}`)
  reader.advance(2)
  const endName = readName(reader)
  skipWhitespace(reader)
  if (reader.advance() !== '>') reader.fail('Unterminated end tag')
  if (endName !== tagName) reader.fail(`Mismatched tag: expected </${tagName}>`)
  return new MiniElement(tagName, names.namespaceURI, names.localName, attributes, children)
}

function parseDocument(source: string): MiniDocument {
  const reader = new Reader(source.charCodeAt(0) === 0xfeff ? source.slice(1) : source)
  skipWhitespace(reader)
  if (reader.startsWith('<?xml')) {
    readUntil(reader, '?>')
    skipWhitespace(reader)
  }
  const children: MiniNode[] = []
  while (!reader.eof()) {
    skipWhitespace(reader)
    if (reader.eof()) break
    if (reader.startsWith('<!--')) {
      reader.advance(4)
      children.push(new MiniComment(readUntil(reader, '-->')))
      continue
    }
    if (reader.startsWith('<?')) {
      children.push(parsePi(reader))
      continue
    }
    if (reader.startsWith('<!DOCTYPE')) {
      children.push(parseDoctype(reader))
      continue
    }
    if (reader.startsWith('<')) {
      children.push(parseElement(reader, new Map([['xml', XML_NS]])))
      skipWhitespace(reader)
      if (!reader.eof()) reader.fail('Unexpected content after the root element')
      break
    }
    reader.fail('Expected a root element')
  }
  if (!children.some((child) => child instanceof MiniElement)) reader.fail('Missing a root element')
  return new MiniDocument(children)
}

function parserErrorDocument(error: XmlSyntaxError): MiniDocument {
  const message = `XML Parsing Error: ${error.message} Line Number ${error.line}, Column ${error.column}:`
  const element = new MiniElement('parsererror', PARSERERROR_NS, 'parsererror', [], [new MiniText(message)])
  return new MiniDocument([element])
}

export class TestDOMParser {
  parseFromString(source: string, mime: string): MiniDocument {
    void mime
    try {
      return parseDocument(source)
    } catch (reason) {
      if (reason instanceof XmlSyntaxError) return parserErrorDocument(reason)
      throw reason
    }
  }
}

export function installTestDomParser() {
  ;(globalThis as { DOMParser?: unknown }).DOMParser = TestDOMParser
}
