export type MemeAlign = 'left' | 'center' | 'right'
export type MemeRole = 'top' | 'bottom'
export type MemeFormat = 'image/png' | 'image/jpeg'
export type MemeFontId =
  | 'impact'
  | 'arial-black'
  | 'arial'
  | 'georgia'
  | 'times'
  | 'courier'
  | 'verdana'
  | 'comic'
  | 'system'

export interface MemeTextLayer {
  id: string
  text: string
  fontSize: number
  fontFamily: MemeFontId
  fill: string
  stroke: string
  strokeWidth: number
  align: MemeAlign
  x: number
  y: number
  maxWidth: number
  role?: MemeRole
}

export interface MemeFont {
  id: MemeFontId
  label: string
  stack: string
}

export const MEME_FONTS: readonly MemeFont[] = [
  { id: 'impact', label: 'Impact', stack: 'Impact, Haettenschweiler, "Franklin Gothic Bold", sans-serif' },
  { id: 'arial-black', label: 'Arial Black', stack: '"Arial Black", Arial, sans-serif' },
  { id: 'arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'georgia', label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'times', label: 'Times New Roman', stack: '"Times New Roman", Times, serif' },
  { id: 'courier', label: 'Courier New', stack: '"Courier New", Courier, monospace' },
  { id: 'verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'comic', label: 'Comic Sans', stack: '"Comic Sans MS", "Comic Sans", cursive' },
  { id: 'system', label: 'System UI', stack: 'system-ui, sans-serif' },
]

export const MEME_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', '.jpg', '.jpeg', '.png', '.webp'] as const
export const MEME_FORMATS: readonly MemeFormat[] = ['image/png', 'image/jpeg']
const DEFAULT_FONT: MemeFont = {
  id: 'impact',
  label: 'Impact',
  stack: 'Impact, Haettenschweiler, "Franklin Gothic Bold", sans-serif',
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function isMemeFontId(value: string): value is MemeFontId {
  return MEME_FONTS.some((font) => font.id === value)
}

export function resolveMemeFont(id: string): MemeFont {
  return MEME_FONTS.find((font) => font.id === id) ?? DEFAULT_FONT
}

export function createMemeLayer(partial: Partial<MemeTextLayer> = {}): MemeTextLayer {
  const layer: MemeTextLayer = {
    id: partial.id ?? `meme-layer-${Math.random().toString(36).slice(2, 10)}`,
    text: partial.text ?? '',
    fontSize: clampRange(partial.fontSize ?? 48, 8, 512),
    fontFamily: partial.fontFamily && isMemeFontId(partial.fontFamily) ? partial.fontFamily : 'impact',
    fill: partial.fill ?? '#ffffff',
    stroke: partial.stroke ?? '#000000',
    strokeWidth: clampRange(partial.strokeWidth ?? 4, 0, 64),
    align: partial.align === 'left' || partial.align === 'right' ? partial.align : 'center',
    x: clamp01(partial.x ?? 0.5),
    y: clamp01(partial.y ?? 0.5),
    maxWidth: clamp01(partial.maxWidth ?? 0.9),
  }
  if (partial.role === 'top' || partial.role === 'bottom') layer.role = partial.role
  return layer
}

export function defaultMemeLayers(size?: { width: number; height: number }): MemeTextLayer[] {
  const shortest = size ? Math.min(size.width, size.height) : 800
  const fontSize = Math.max(28, Math.round(shortest * 0.09))
  const strokeWidth = Math.max(3, Math.round(fontSize / 12))
  return [
    createMemeLayer({ id: 'top', role: 'top', y: 0.1, fontSize, strokeWidth }),
    createMemeLayer({ id: 'bottom', role: 'bottom', y: 0.9, fontSize, strokeWidth }),
  ]
}

export function getMemeCaption(layers: readonly MemeTextLayer[], role: MemeRole): string {
  return layers.find((layer) => layer.role === role)?.text ?? ''
}

export function setMemeCaption(layers: readonly MemeTextLayer[], role: MemeRole, text: string): MemeTextLayer[] {
  return layers.map((layer) => layer.role === role ? { ...layer, text } : layer)
}

export function updateMemeLayer(layers: readonly MemeTextLayer[], id: string, patch: Partial<MemeTextLayer>): MemeTextLayer[] {
  return layers.map((layer) => layer.id === id ? createMemeLayer({ ...layer, ...patch, id: layer.id }) : layer)
}

export function addMemeLayer(layers: readonly MemeTextLayer[], layer: MemeTextLayer = createMemeLayer()): MemeTextLayer[] {
  return [...layers, layer]
}

export function removeMemeLayer(layers: readonly MemeTextLayer[], id: string): MemeTextLayer[] {
  const target = layers.find((layer) => layer.id === id)
  if (!target || target.role) return [...layers]
  return layers.filter((layer) => layer.id !== id)
}

export function nudgeMemeLayer(layers: readonly MemeTextLayer[], id: string, dx: number, dy: number): MemeTextLayer[] {
  return updateMemeLayer(layers, id, {
    x: clamp01((layers.find((layer) => layer.id === id)?.x ?? 0.5) + dx),
    y: clamp01((layers.find((layer) => layer.id === id)?.y ?? 0.5) + dy),
  })
}

export function hasMemeText(layers: readonly MemeTextLayer[]): boolean {
  return layers.some((layer) => layer.text.trim().length > 0)
}

export function wrapMemeText(measure: { measureText(text: string): { width: number } }, text: string, maxWidth: number): string[] {
  const width = Math.max(1, maxWidth)
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let current = words[0]!
    for (const word of words.slice(1)) {
      const next = `${current} ${word}`
      if (measure.measureText(next).width <= width) current = next
      else {
        lines.push(current)
        current = word
      }
    }
    lines.push(current)
  }
  return lines
}

export function drawMemeLayers(
  context: CanvasRenderingContext2D,
  canvas: { width: number; height: number },
  layers: readonly MemeTextLayer[],
): void {
  for (const layer of layers) {
    const text = layer.text.trim()
    if (!text) continue
    const font = resolveMemeFont(layer.fontFamily)
    const fontSize = clampRange(layer.fontSize, 8, 512)
    const strokeWidth = clampRange(layer.strokeWidth, 0, 64)
    const align = layer.align === 'left' || layer.align === 'right' ? layer.align : 'center'
    const maxWidth = Math.max(8, clamp01(layer.maxWidth) * canvas.width)
    context.save()
    context.font = `700 ${fontSize}px ${font.stack}`
    context.textAlign = align
    context.textBaseline = 'middle'
    context.lineJoin = 'round'
    context.miterLimit = 2
    context.lineWidth = strokeWidth
    context.fillStyle = layer.fill
    context.strokeStyle = layer.stroke
    const lines = wrapMemeText(context, text, maxWidth)
    const lineHeight = fontSize * 1.1
    const blockHeight = lines.length * lineHeight
    const x = clamp01(layer.x) * canvas.width
    let y = clamp01(layer.y) * canvas.height - blockHeight / 2 + lineHeight / 2
    for (const line of lines) {
      if (strokeWidth > 0) context.strokeText(line, x, y, maxWidth)
      context.fillText(line, x, y, maxWidth)
      y += lineHeight
    }
    context.restore()
  }
}

function clampRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}
