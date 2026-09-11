import { assertValidImageSize, type Size } from '@/features/image/image-utils'

const SVG_NS = 'http://www.w3.org/2000/svg'
const FALLBACK_SIZE: Size = { width: 300, height: 150 }
const DANGEROUS_TAGS = ['script', 'foreignobject', 'iframe', 'object', 'embed', 'link'] as const
const URL_ATTRS = new Set(['href', 'xlink:href', 'src', 'poster'])

export type SvgDimensionSource = 'width-height' | 'viewBox' | 'fallback'

export interface SvgDimensions extends Size {
  source: SvgDimensionSource
}

export interface ParsedSvg {
  markup: string
  dimensions: SvgDimensions
  warnings: string[]
}

export interface SvgToPngOptions {
  width?: number
  height?: number
  scale?: number
  background?: 'transparent' | string
  preserveAspectRatio?: boolean
}

export interface SvgToPngResult {
  blob: Blob
  width: number
  height: number
  warnings: string[]
}

export function parseSvgMarkup(source: string): ParsedSvg {
  const text = source.replace(/^﻿/, '').trim()
  if (!text) throw new Error('SVG is empty.')
  if (typeof DOMParser !== 'undefined') return parseWithDom(text)
  return parseWithoutDom(text)
}

export function resolveOutputSize(intrinsic: Size, options: SvgToPngOptions = {}): Size {
  const scale = options.scale && Number.isFinite(options.scale) && options.scale > 0 ? options.scale : 1
  const scaled = {
    width: Math.max(1, Math.round(intrinsic.width * scale)),
    height: Math.max(1, Math.round(intrinsic.height * scale)),
  }
  const width = toPositiveInt(options.width)
  const height = toPositiveInt(options.height)
  const preserve = options.preserveAspectRatio !== false
  if (width && height) {
    if (!preserve) return { width, height }
    return { width, height: Math.max(1, Math.round(width * intrinsic.height / intrinsic.width)) }
  }
  if (width) return { width, height: Math.max(1, Math.round(width * intrinsic.height / intrinsic.width)) }
  if (height) return { width: Math.max(1, Math.round(height * intrinsic.width / intrinsic.height)), height }
  return scaled
}

export async function svgToPng(source: string, options: SvgToPngOptions = {}): Promise<SvgToPngResult> {
  const parsed = parseSvgMarkup(source)
  const size = resolveOutputSize(parsed.dimensions, options)
  assertValidImageSize(size.width, size.height)
  const blob = await rasterizeSvg(parsed.markup, parsed.dimensions, size, options.background ?? 'transparent', options.preserveAspectRatio !== false)
  return { blob, width: size.width, height: size.height, warnings: parsed.warnings }
}

export function readPngSize(bytes: Uint8Array): Size {
  if (bytes.length < 24 || !isPngSignature(bytes)) throw new Error('Not a PNG.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!) !== 'IHDR') throw new Error('Not a PNG.')
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

export function isPngSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
}

function parseWithDom(source: string): ParsedSvg {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (document.querySelector('parsererror')) throw new Error('The source is not valid SVG.')
  const svg = document.documentElement
  if (!svg || svg.localName.toLowerCase() !== 'svg') throw new Error('The source is not valid SVG.')
  const warnings: string[] = []
  sanitizeElement(svg, warnings)
  if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', SVG_NS)
  const markup = serializeSvg(svg)
  return {
    markup,
    dimensions: readDimensions(svg.getAttribute('width') ?? undefined, svg.getAttribute('height') ?? undefined, svg.getAttribute('viewBox') ?? undefined),
    warnings: unique(warnings),
  }
}

function parseWithoutDom(source: string): ParsedSvg {
  if (!isSvgMarkup(source)) throw new Error('The source is not valid SVG.')
  const warnings: string[] = []
  const markup = ensureXmlns(sanitizeSvgText(source, warnings))
  const tag = rootSvgOpenTag(markup)
  return {
    markup,
    dimensions: readDimensions(getAttribute(tag, 'width'), getAttribute(tag, 'height'), getAttribute(tag, 'viewBox')),
    warnings: unique(warnings),
  }
}

export function readDimensions(widthAttr?: string, heightAttr?: string, viewBoxAttr?: string): SvgDimensions {
  const viewBox = parseViewBox(viewBoxAttr)
  const width = parseLength(widthAttr, viewBox?.width)
  const height = parseLength(heightAttr, viewBox?.height)
  if (width && height) return roundSize(width, height, 'width-height')
  if (width && viewBox) return roundSize(width, width * viewBox.height / viewBox.width, 'width-height')
  if (height && viewBox) return roundSize(height * viewBox.width / viewBox.height, height, 'width-height')
  if (viewBox) return roundSize(viewBox.width, viewBox.height, 'viewBox')
  if (width) return roundSize(width, width * FALLBACK_SIZE.height / FALLBACK_SIZE.width, 'width-height')
  if (height) return roundSize(height * FALLBACK_SIZE.width / FALLBACK_SIZE.height, height, 'width-height')
  return { ...FALLBACK_SIZE, source: 'fallback' }
}

function parseLength(value: string | undefined, percentOf?: number): number | undefined {
  if (!value) return
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === 'auto') return
  if (trimmed.endsWith('%')) {
    if (!percentOf) return
    const percent = Number.parseFloat(trimmed)
    if (!Number.isFinite(percent) || percent <= 0) return
    return (percent / 100) * percentOf
  }
  const match = /^([+]?(?:\d+\.?\d*|\.\d+))(px|pt|pc|mm|cm|in|em|ex|rem)?$/i.exec(trimmed)
  if (!match) return
  const count = Number(match[1])
  if (!Number.isFinite(count) || count <= 0) return
  const unit = (match[2] ?? 'px').toLowerCase()
  if (unit === 'pt') return count * (96 / 72)
  if (unit === 'pc') return count * 16
  if (unit === 'in') return count * 96
  if (unit === 'mm') return count * (96 / 25.4)
  if (unit === 'cm') return count * (96 / 2.54)
  return count
}

function parseViewBox(value: string | undefined): Size | undefined {
  if (!value) return
  const parts = value.trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return
  const width = Math.abs(parts[2] ?? 0)
  const height = Math.abs(parts[3] ?? 0)
  if (width <= 0 || height <= 0) return
  return { width, height }
}

function roundSize(width: number, height: number, source: SvgDimensionSource): SvgDimensions {
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), source }
}

function sanitizeElement(element: Element, warnings: string[]): void {
  const removed: Element[] = []
  const visit = (node: Element) => {
    if (DANGEROUS_TAGS.includes(node.localName.toLowerCase() as typeof DANGEROUS_TAGS[number])) {
      removed.push(node)
      return
    }
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || name === 'srcdoc') {
        node.removeAttribute(attribute.name)
        continue
      }
      if (URL_ATTRS.has(name) || name.endsWith(':href')) {
        const value = attribute.value.trim()
        if (isDangerousUrl(value)) {
          node.removeAttribute(attribute.name)
          continue
        }
        if (isExternalResource(value)) {
          warnings.push(`Unsupported external resource: ${value}`)
          node.removeAttribute(attribute.name)
        }
      }
      if (name === 'style') {
        const next = scrubCss(attribute.value, warnings)
        if (next) node.setAttribute('style', next)
        else node.removeAttribute('style')
      }
    }
    if (node.localName.toLowerCase() === 'style') node.textContent = scrubCss(node.textContent ?? '', warnings)
    for (const child of [...node.children]) visit(child)
  }
  visit(element)
  for (const node of removed) node.remove()
}

function sanitizeSvgText(source: string, warnings: string[]): string {
  collectExternalResources(source, warnings)
  let markup = source
  for (const tag of DANGEROUS_TAGS) {
    markup = markup.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '')
    markup = markup.replace(new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi'), '')
  }
  markup = markup.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  markup = markup.replace(/\s(?:href|xlink:href|src|poster)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '')
  markup = markup.replace(/\s(?:href|xlink:href|src|poster)\s*=\s*(?:"(?!#|data:)[^"]+"|'(?!#|data:)[^']+')/gi, '')
  markup = markup.replace(/@import[^;]+;?/gi, '')
  markup = markup.replace(/url\(\s*(['"]?)(?!#|data:)([^)'"]+)\1\s*\)/gi, 'none')
  return markup
}

function collectExternalResources(source: string, warnings: string[]): void {
  const attribute = /\s(?:href|xlink:href|src|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
  for (const match of source.matchAll(attribute)) {
    const value = (match[1] ?? match[2] ?? '').trim()
    if (isExternalResource(value) && !isDangerousUrl(value)) warnings.push(`Unsupported external resource: ${value}`)
  }
  const cssUrl = /url\(\s*(['"]?)(?!#|data:)([^)'"]+)\1\s*\)/gi
  for (const match of source.matchAll(cssUrl)) {
    const value = (match[2] ?? '').trim()
    if (value) warnings.push(`Unsupported external resource: ${value}`)
  }
  const imports = /@import\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?/gi
  for (const match of source.matchAll(imports)) {
    const value = (match[1] ?? '').trim()
    if (value && isExternalResource(value)) warnings.push(`Unsupported external resource: ${value}`)
  }
}

function scrubCss(css: string, warnings: string[]): string {
  let next = css.replace(/@import[^;]+;?/gi, (match) => {
    const url = /['"]?((?:https?:)?\/\/[^'")\s]+|[^'")\s]+)['"]?/.exec(match)?.[1]
    if (url && isExternalResource(url)) warnings.push(`Unsupported external resource: ${url}`)
    return ''
  })
  next = next.replace(/url\(\s*(['"]?)([^)]+?)\1\s*\)/gi, (match, _quote: string, raw: string) => {
    const value = raw.trim()
    if (!isExternalResource(value)) return match
    warnings.push(`Unsupported external resource: ${value}`)
    return 'none'
  })
  return next.trim()
}

function isDangerousUrl(value: string): boolean {
  return /^(?:javascript|vbscript|data:text\/html)/i.test(value.trim())
}

function isExternalResource(value: string): boolean {
  const trimmed = value.trim().replace(/^url\((.+)\)$/s, '$1').trim().replace(/^['"]|['"]$/g, '')
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('data:')) return false
  return true
}

function isSvgMarkup(source: string): boolean {
  return /^<svg\b/i.test(stripPreamble(source))
}

function stripPreamble(source: string): string {
  return source
    .replace(/^﻿/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .trim()
}

function rootSvgOpenTag(markup: string): string {
  const match = /^<svg\b[^>]*>/i.exec(stripPreamble(markup))
  if (!match) throw new Error('The source is not valid SVG.')
  return match[0]
}

function getAttribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return match?.[1] ?? match?.[2]
}

function ensureXmlns(markup: string): string {
  const tag = rootSvgOpenTag(markup)
  if (/\sxmlns\s*=/i.test(tag)) return markup
  return markup.replace(/<svg\b/i, `<svg xmlns="${SVG_NS}"`)
}

function serializeSvg(svg: Element): string {
  if (typeof XMLSerializer !== 'undefined') return new XMLSerializer().serializeToString(svg)
  return svg.outerHTML
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function toPositiveInt(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return
  const rounded = Math.round(value)
  return rounded >= 1 ? rounded : undefined
}

async function rasterizeSvg(markup: string, intrinsic: Size, size: Size, background: string, preserveAspectRatio: boolean): Promise<Blob> {
  const svgBlob = new Blob([sizedMarkup(markup, intrinsic, size, preserveAspectRatio)], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  let bitmap: ImageBitmap | undefined
  try {
    const image = await loadImage(url, size)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('Canvas is not available in this browser.')
    if (background && background !== 'transparent') {
      context.fillStyle = background
      context.fillRect(0, 0, size.width, size.height)
    } else {
      context.clearRect(0, 0, size.width, size.height)
    }
    let source: CanvasImageSource = image
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(image)
        source = bitmap
      } catch {
        source = image
      }
    }
    context.drawImage(source, 0, 0, size.width, size.height)
    return await canvasToPng(canvas)
  } finally {
    bitmap?.close()
    URL.revokeObjectURL(url)
  }
}

function sizedMarkup(markup: string, intrinsic: Size, size: Size, preserveAspectRatio: boolean): string {
  const ratio = preserveAspectRatio ? 'xMidYMid meet' : 'none'
  const viewBox = `0 0 ${intrinsic.width} ${intrinsic.height}`
  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(markup, 'image/svg+xml')
    const svg = document.documentElement
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', viewBox)
    svg.setAttribute('width', String(size.width))
    svg.setAttribute('height', String(size.height))
    svg.setAttribute('preserveAspectRatio', ratio)
    return serializeSvg(svg)
  }
  const tag = rootSvgOpenTag(markup)
  const withViewBox = /\sviewBox\s*=/i.test(tag) ? tag : tag.replace(/<svg\b/i, `<svg viewBox="${viewBox}"`)
  const next = withViewBox
    .replace(/\swidth\s*=\s*(?:"[^"]*"|'[^']*')/i, '')
    .replace(/\sheight\s*=\s*(?:"[^"]*"|'[^']*')/i, '')
    .replace(/\spreserveAspectRatio\s*=\s*(?:"[^"]*"|'[^']*')/i, '')
    .replace(/<svg\b/i, `<svg width="${size.width}" height="${size.height}" preserveAspectRatio="${ratio}"`)
  return markup.replace(tag, next)
}

function loadImage(url: string, size: Size): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The SVG could not be rendered.'))
    image.width = size.width
    image.height = size.height
    image.src = url
  })
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG export failed.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}
