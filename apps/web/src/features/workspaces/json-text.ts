export function textFromJsonPayload(value: unknown): string | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null
  const text = Reflect.get(value, 'text')
  if (typeof text !== 'string') return null
  return text.replace(/\r\n/g, '\n')
}

export function textDownloadName(filename: string): string {
  const trimmed = filename.trim()
  const dot = trimmed.lastIndexOf('.')
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed
  return `${base || 'extracted'}.txt`
}
