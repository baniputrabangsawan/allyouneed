export type JsonAction = 'format' | 'validate' | 'minify'

export function processJson(input: string, action: JsonAction): string {
  const value: unknown = JSON.parse(input)
  if (action === 'validate') return 'Valid JSON'
  return JSON.stringify(value, null, action === 'format' ? 2 : undefined)
}

export interface TextCounts {
  words: number
  characters: number
  charactersWithoutSpaces: number
  lines: number
}

export function countText(value: string): TextCounts {
  return {
    words: value.trim() ? value.trim().split(/\s+/u).length : 0,
    characters: Array.from(value).length,
    charactersWithoutSpaces: Array.from(value.replace(/\s/gu, '')).length,
    lines: value ? value.split(/\r\n?|\n/u).length : 0,
  }
}

export interface EmvTag {
  tag: string
  value: string
}

export interface QrisParseResult {
  tags: EmvTag[]
  checksum: 'valid' | 'invalid' | 'missing'
}

function crc16(value: string): string {
  let crc = 0xffff
  for (const character of value) {
    crc ^= character.charCodeAt(0) << 8
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function parseQris(input: string): QrisParseResult {
  const payload = input.trim()
  if (!payload) throw new Error('Enter a QRIS payload.')
  const tags: EmvTag[] = []
  let offset = 0
  while (offset < payload.length) {
    if (offset + 4 > payload.length) throw new Error(`Incomplete TLV header at position ${offset}.`)
    const tag = payload.slice(offset, offset + 2)
    const lengthText = payload.slice(offset + 2, offset + 4)
    if (!/^\d{2}$/u.test(tag) || !/^\d{2}$/u.test(lengthText)) throw new Error(`Invalid TLV header at position ${offset}.`)
    const length = Number(lengthText)
    const valueStart = offset + 4
    const valueEnd = valueStart + length
    if (valueEnd > payload.length) throw new Error(`Tag ${tag} declares ${length} characters but its value is incomplete.`)
    tags.push({ tag, value: payload.slice(valueStart, valueEnd) })
    offset = valueEnd
  }
  if (tags[0]?.tag !== '00' || tags[0].value !== '01') throw new Error('Payload Format Indicator 00 must contain 01.')
  const checksumTag = [...tags].reverse().find(({ tag }) => tag === '63')
  if (!checksumTag) return { tags, checksum: 'missing' }
  if (checksumTag.value.length !== 4 || !/^[0-9A-F]{4}$/iu.test(checksumTag.value) || !payload.endsWith(`6304${checksumTag.value}`)) return { tags, checksum: 'invalid' }
  return { tags, checksum: crc16(payload.slice(0, -4)) === checksumTag.value.toUpperCase() ? 'valid' : 'invalid' }
}

export type QrKind = 'text' | 'url' | 'wifi' | 'whatsapp' | 'email' | 'phone' | 'vcard' | 'location'
export type QrCorrection = 'L' | 'M' | 'Q' | 'H'
export type QrFields = Record<string, string>

function escapeWifi(value: string): string { return value.replace(/([\\;,:"])/gu, '\\$1') }
function escapeVcard(value: string): string { return value.replace(/([\\;,])/gu, '\\$1').replace(/\r?\n/gu, '\\n') }

export function getQrKind(slug: string): QrKind {
  if (slug.startsWith('url-')) return 'url'
  if (slug.startsWith('wifi-')) return 'wifi'
  if (slug.startsWith('whatsapp-')) return 'whatsapp'
  if (slug.startsWith('email-')) return 'email'
  if (slug.startsWith('phone-')) return 'phone'
  if (slug.startsWith('vcard-')) return 'vcard'
  if (slug.startsWith('location-')) return 'location'
  return 'text'
}

export function buildQrPayload(kind: QrKind, fields: QrFields): string {
  const get = (key: string) => (fields[key] ?? '').trim()
  if (kind === 'url') return get('url')
  if (kind === 'wifi') return `WIFI:T:${escapeWifi(get('encryption') || 'WPA')};S:${escapeWifi(get('ssid'))};P:${escapeWifi(get('password'))};;`
  if (kind === 'whatsapp') return `https://wa.me/${get('phone').replace(/\D/gu, '')}${get('message') ? `?text=${encodeURIComponent(get('message'))}` : ''}`
  if (kind === 'email') {
    const query = new URLSearchParams([['subject', get('subject')], ['body', get('body')]].filter((entry) => entry[1]) as [string, string][]).toString()
    return `mailto:${get('email')}${query ? `?${query}` : ''}`
  }
  if (kind === 'phone') return `tel:${get('phone')}`
  if (kind === 'vcard') return ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeVcard(get('name'))}`, `ORG:${escapeVcard(get('organization'))}`, `TEL:${get('phone')}`, `EMAIL:${get('email')}`, `URL:${get('url')}`, 'END:VCARD'].filter((line) => !line.endsWith(':')).join('\r\n')
  if (kind === 'location') return `geo:${get('latitude')},${get('longitude')}${get('label') ? `?q=${get('latitude')},${get('longitude')}(${encodeURIComponent(get('label'))})` : ''}`
  return get('text')
}
