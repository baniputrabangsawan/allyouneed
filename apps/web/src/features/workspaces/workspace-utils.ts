export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export const base64ToBytes = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

export const encodeBase64Text = (value: string): string => bytesToBase64(new TextEncoder().encode(value))

export const decodeBase64Text = (value: string): string =>
  new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(value.trim()))

export const decodeJwtPayload = (value: string): string => {
  const parts = value.trim().split('.')
  if (parts.length !== 3 || !parts[1]) throw new Error('Enter a JWT with three dot-separated sections.')
  return JSON.stringify(JSON.parse(decodeBase64Text(parts[1])) as unknown, null, 2)
}

export const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export const markdownToSafeHtml = (value: string): string => escapeHtml(value)
  .replace(/^### (.+)$/gm, '<h3>$1</h3>')
  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
  .replace(/^# (.+)$/gm, '<h1>$1</h1>')
  .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
  .split(/\n{2,}/).map((block) => /^<(?:h\d|li)/.test(block) ? block : `<p>${block.replace(/\n/g, '<br>')}</p>`).join('\n')

export const htmlToMarkdown = (value: string): string => value
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level: string, text: string) => `${'#'.repeat(Number(level))} ${text}\n\n`)
  .replace(/<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
  .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
  .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
  .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
  .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&')
  .replace(/\n{3,}/g, '\n\n').trim()

const titleCase = (value: string): string => value.toLocaleLowerCase().replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase())
const sentenceCase = (value: string): string => value.toLocaleLowerCase().replace(/(^\s*|[.!?]\s+)\p{L}/gu, (letter) => letter.toLocaleUpperCase())
const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
const removeControlCharacters = (value: string): string => [...value].filter((character) => {
  const code = character.codePointAt(0) ?? 0
  return code > 31 && code !== 127 || code === 9 || code === 10 || code === 13
}).join('')

export type TextCase = 'upper' | 'lower' | 'title' | 'sentence'

export const transformText = (slug: string, input: string, second = '', textCase: TextCase = 'upper'): string => {
  switch (slug) {
    case 'case-converter': return textCase === 'upper' ? input.toLocaleUpperCase() : textCase === 'lower' ? input.toLocaleLowerCase() : textCase === 'title' ? titleCase(input) : sentenceCase(input)
    case 'remove-duplicate-lines': return [...new Set(input.split(/\r?\n/))].join('\n')
    case 'remove-extra-spaces': return input.replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').trim()
    case 'sort-lines': return input.split(/\r?\n/).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).join('\n')
    case 'text-cleaner': return removeControlCharacters(input).replace(/\r\n?/g, '\n').replace(/[\t ]+$/gm, '').trim()
    case 'text-formatter': return input.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim().replace(/[\t ]+/g, ' ')).join('\n').replace(/\n{3,}/g, '\n\n').trim()
    case 'lorem-ipsum-generator': return Array.from({ length: Math.max(1, Math.min(20, Number(input) || 3)) }, () => lorem).join('\n\n')
    case 'slug-generator': return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    case 'text-compare': return input === second ? 'The texts are identical.' : 'The texts are different.'
    case 'text-diff': return lineDiff(input, second)
    case 'markdown-preview':
    case 'markdown-to-html': return markdownToSafeHtml(input)
    case 'html-to-markdown': return htmlToMarkdown(input)
    default: return input
  }
}

export const lineDiff = (left: string, right: string): string => {
  const before = left.split(/\r?\n/)
  const after = right.split(/\r?\n/)
  return Array.from({ length: Math.max(before.length, after.length) }, (_, index) => {
    if (before[index] === after[index]) return `  ${before[index] ?? ''}`
    return `${before[index] === undefined ? '' : `- ${before[index]}\n`}${after[index] === undefined ? '' : `+ ${after[index]}`}`
  }).filter(Boolean).join('\n')
}

export const secureRandomInt = (minimum: number, maximum: number): number => {
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || maximum < minimum || maximum - minimum >= 0x1_0000_0000) throw new Error('Use safe integers with a range smaller than 4,294,967,296.')
  const range = maximum - minimum + 1
  const limit = Math.floor(0x1_0000_0000 / range) * range
  const sample = new Uint32Array(1)
  do crypto.getRandomValues(sample); while ((sample[0] ?? limit) >= limit)
  return minimum + (sample[0] ?? 0) % range
}

export const secureString = (length: number, alphabet: string): string => {
  if (!Number.isSafeInteger(length) || length < 1 || length > 1024 || !alphabet || alphabet.length > 256) throw new Error('Choose a length from 1 to 1024 and a non-empty character set.')
  const limit = 256 - (256 % alphabet.length)
  let result = ''
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length - result.length))
    for (const byte of bytes) if (byte < limit && result.length < length) result += alphabet[byte % alphabet.length]
  }
  return result
}

export interface Hsl { h: number; s: number; l: number }
export interface Rgb { r: number; g: number; b: number }

export const hexToRgb = (hex: string): Rgb => {
  const normalized = hex.trim().replace(/^#/, '')
  const full = normalized.length === 3 ? [...normalized].map((part) => part + part).join('') : normalized
  if (!/^[\da-f]{6}$/i.test(full)) throw new Error('Enter a 3 or 6 digit HEX color.')
  return { r: Number.parseInt(full.slice(0, 2), 16), g: Number.parseInt(full.slice(2, 4), 16), b: Number.parseInt(full.slice(4, 6), 16) }
}

export const rgbToHex = ({ r, g, b }: Rgb): string => `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

export const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const [red, green, blue] = [r / 255, g / 255, b / 255]
  const maximum = Math.max(red, green, blue), minimum = Math.min(red, green, blue), delta = maximum - minimum
  let hue = 0
  if (delta) hue = maximum === red ? ((green - blue) / delta) % 6 : maximum === green ? (blue - red) / delta + 2 : (red - green) / delta + 4
  const lightness = (maximum + minimum) / 2
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0
  return { h: Math.round((hue * 60 + 360) % 360), s: Math.round(saturation * 100), l: Math.round(lightness * 100) }
}

export const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const saturation = s / 100, lightness = l / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const section = ((h % 360) + 360) % 360 / 60, x = chroma * (1 - Math.abs(section % 2 - 1)), offset = lightness - chroma / 2
  const [red, green, blue] = section < 1 ? [chroma, x, 0] : section < 2 ? [x, chroma, 0] : section < 3 ? [0, chroma, x] : section < 4 ? [0, x, chroma] : section < 5 ? [x, 0, chroma] : [chroma, 0, x]
  return { r: Math.round((red + offset) * 255), g: Math.round((green + offset) * 255), b: Math.round((blue + offset) * 255) }
}

export const relativeLuminance = ({ r, g, b }: Rgb): number => {
  const toLinear = (value: number) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

export const contrastForeground = (hex: string): '#111111' | '#FFFFFF' => {
  const luminance = relativeLuminance(hexToRgb(hex))
  const contrastWithWhite = 1.05 / (luminance + 0.05)
  const contrastWithBlack = (luminance + 0.05) / 0.05
  return contrastWithWhite >= contrastWithBlack ? '#FFFFFF' : '#111111'
}

export const formatBytes = (bytes: number): string => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`
