export type XmlAction = 'format' | 'minify' | 'validate'
export type XmlIndent = '2' | '4' | 'tab'

export const XML_MAX_CHARS = 2_000_000
export const XML_YIELD_THRESHOLD = 80_000

const ELEMENT_NODE = 1
const TEXT_NODE = 3
const CDATA_SECTION_NODE = 4
const PROCESSING_INSTRUCTION_NODE = 7
const COMMENT_NODE = 8
const DOCUMENT_TYPE_NODE = 10

const PARSERERROR_MOZILLA = 'http://www.mozilla.org/newlayout/xml/parsererror.xml'
const PARSERERROR_XHTML = 'http://www.w3.org/1999/xhtml'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'

export class XmlParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XmlParseError'
  }
}

export function indentUnit(indent: XmlIndent): string {
  return indent === 'tab' ? '\t' : ' '.repeat(Number(indent))
}

export function processXml(input: string, action: XmlAction, indent: XmlIndent = '2'): string {
  const document = parseXml(input)
  if (action === 'validate') return 'Valid XML'
  const declaration = extractXmlDeclaration(input)
  return serializeXml(document, {
    minify: action === 'minify',
    indent: indentUnit(indent),
    ...(declaration ? { declaration } : {}),
  })
}

export function parseXml(input: string): Document {
  const source = stripBom(input)
  if (!source.trim()) throw new XmlParseError('Enter XML to process.')
  if (source.length > XML_MAX_CHARS) {
    throw new XmlParseError(`XML is too large to process in the browser (max ${XML_MAX_CHARS.toLocaleString()} characters).`)
  }
  if (typeof DOMParser === 'undefined') {
    throw new XmlParseError('XML parsing is not supported in this environment.')
  }
  let document: Document
  try {
    document = new DOMParser().parseFromString(source, 'application/xml')
  } catch (reason) {
    throw new XmlParseError(reason instanceof Error ? reason.message : 'Invalid XML.')
  }
  const error = readParserError(document, source)
  if (error) throw new XmlParseError(error)
  if (!document.documentElement) throw new XmlParseError('Invalid XML: missing a root element.')
  return document
}

export function extractXmlDeclaration(input: string): string | undefined {
  const match = stripBom(input).match(/^\s*<\?xml\b[^?]*\?>/u)
  return match?.[0]?.trim()
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

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value
}

function readParserError(document: Document, source: string): string | null {
  const errorElement = findParserErrorElement(document, source)
  if (!errorElement) return null
  const raw = (errorElement.textContent ?? '').replace(/\s+/gu, ' ').trim() || 'The XML could not be parsed.'
  const match = raw.match(/line(?:\s+number)?\s+(\d+)(?:\s*(?:at|,\s*)column\s+(\d+))?/iu)
  if (!match) return `Invalid XML: ${raw}`
  const lineNumber = Number(match[1])
  const column = match[2] ? Number(match[2]) : undefined
  const lines = source.split(/\r\n|\n|\r/u)
  const lineText = lines[lineNumber - 1]
  const gutter = `${lineNumber} | `
  const excerpt = lineText === undefined
    ? ''
    : `\n${gutter}${lineText}${column ? `\n${' '.repeat(gutter.length + Math.max(0, column - 1))}^` : ''}`
  const detail = raw.replace(/^This page contains the following errors:\s*/iu, '')
  return `Invalid XML on line ${lineNumber}${column !== undefined ? `, column ${column}` : ''}. ${detail}${excerpt}`
}

function findParserErrorElement(document: Document, source: string): Element | null {
  const root = document.documentElement
  if (!root) return null
  const mozilla = document.getElementsByTagNameNS(PARSERERROR_MOZILLA, 'parsererror')[0]
  const xhtml = document.getElementsByTagNameNS(PARSERERROR_XHTML, 'parsererror')[0]
  const plain = document.getElementsByTagName('parsererror')[0]
  const candidate = mozilla ?? xhtml ?? (root.localName === 'parsererror' ? root : null)
  if (!candidate && !plain) return null
  const trimmed = stripBom(source).replace(/^\s*<\?xml\b[^?]*\?>\s*/u, '').trim()
  if (root.localName === 'parsererror') {
    if (/^<parsererror(?:\s|>|\/>)/u.test(trimmed) && !mozilla) return null
    return candidate ?? root
  }
  if (root.namespaceURI === PARSERERROR_XHTML && root.localName === 'html' && (xhtml ?? plain)) {
    if (/^<html(?:\s|>|\/>)/iu.test(trimmed) && !/This page contains the following errors/iu.test((xhtml ?? plain)?.textContent ?? '')) {
      return null
    }
    return xhtml ?? plain ?? null
  }
  return mozilla ?? null
}

function serializeXml(document: Document, options: { minify: boolean; indent: string; declaration?: string }): string {
  const parts: string[] = []
  if (options.declaration) parts.push(options.declaration)
  const nodes = document.childNodes
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index)
    if (!node) continue
    if (node.nodeType === PROCESSING_INSTRUCTION_NODE && (node as ProcessingInstruction).target === 'xml') continue
    if (node.nodeType === DOCUMENT_TYPE_NODE) {
      parts.push(serializeDoctype(node as DocumentType))
      continue
    }
    const serialized = serializeNode(node, options.indent, 0, options.minify, false)
    if (serialized) parts.push(serialized)
  }
  return options.minify ? parts.join('') : parts.join('\n')
}

function serializeDoctype(doctype: DocumentType): string {
  if (doctype.publicId) return `<!DOCTYPE ${doctype.name} PUBLIC "${doctype.publicId}" "${doctype.systemId}">`
  if (doctype.systemId) return `<!DOCTYPE ${doctype.name} SYSTEM "${doctype.systemId}">`
  return `<!DOCTYPE ${doctype.name}>`
}

function serializeNode(node: Node, indent: string, depth: number, minify: boolean, preserveSpace: boolean): string {
  switch (node.nodeType) {
    case ELEMENT_NODE:
      return serializeElement(node as Element, indent, depth, minify, preserveSpace)
    case TEXT_NODE:
      return escapeText((node as Text).data)
    case CDATA_SECTION_NODE:
      return `<![CDATA[${(node as CDATASection).data}]]>`
    case COMMENT_NODE:
      return `<!--${(node as Comment).data}-->`
    case PROCESSING_INSTRUCTION_NODE: {
      const instruction = node as ProcessingInstruction
      return instruction.data ? `<?${instruction.target} ${instruction.data}?>` : `<?${instruction.target}?>`
    }
    default:
      return ''
  }
}

function serializeElement(element: Element, indent: string, depth: number, minify: boolean, inheritedPreserve: boolean): string {
  const name = element.tagName
  const attributes = serializeAttributes(element)
  const openStart = attributes ? `<${name} ${attributes}` : `<${name}`
  const preserveSpace = inheritedPreserve || hasPreserveSpace(element)
  const mixed = preserveSpace || isMixedContent(element)
  const children: Node[] = []
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index)
    if (!child) continue
    if (!mixed && !minify && isIgnorableWhitespace(child)) continue
    if (minify && !mixed && isIgnorableWhitespace(child)) continue
    children.push(child)
  }
  if (children.length === 0) return `${openStart}/>`
  const open = `${openStart}>`
  const close = `</${name}>`
  if (minify || mixed) {
    let inner = ''
    for (const child of children) inner += serializeNode(child, indent, depth, minify, preserveSpace)
    return `${open}${inner}${close}`
  }
  if (children.length === 1) {
    const only = children[0]!
    if (only.nodeType === TEXT_NODE || only.nodeType === CDATA_SECTION_NODE) {
      return `${open}${serializeNode(only, indent, depth, false, preserveSpace)}${close}`
    }
  }
  const childIndent = indent.repeat(depth + 1)
  const closeIndent = indent.repeat(depth)
  const lines = children.map((child) => `${childIndent}${serializeNode(child, indent, depth + 1, false, preserveSpace)}`)
  return `${open}\n${lines.join('\n')}\n${closeIndent}${close}`
}

function serializeAttributes(element: Element): string {
  const parts: string[] = []
  const attributes = element.attributes
  for (let index = 0; index < attributes.length; index += 1) {
    const attribute = attributes.item(index)
    if (!attribute) continue
    parts.push(`${attribute.name}="${escapeAttr(attribute.value)}"`)
  }
  return parts.join(' ')
}

function isMixedContent(element: Element): boolean {
  let hasElement = false
  let hasSignificantText = false
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index)
    if (!child) continue
    if (child.nodeType === ELEMENT_NODE) hasElement = true
    if ((child.nodeType === TEXT_NODE || child.nodeType === CDATA_SECTION_NODE) && (child as CharacterData).data.trim() !== '') {
      hasSignificantText = true
    }
    if (hasElement && hasSignificantText) return true
  }
  return false
}

function isIgnorableWhitespace(node: Node): boolean {
  return node.nodeType === TEXT_NODE && (node as Text).data.trim() === ''
}

function hasPreserveSpace(element: Element): boolean {
  const value = element.getAttributeNS(XML_NS, 'space') ?? element.getAttribute('xml:space')
  if (value === 'preserve') return true
  if (value === 'default') return false
  const parent = element.parentElement
  return parent ? hasPreserveSpace(parent) : false
}

function escapeText(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;')
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/gu, '&quot;')
}
