export function normalizeMimeType(type: string): string {
  return type.toLowerCase().split(';')[0]?.trim() ?? ''
}

export function fileExtension(name: string): string {
  const base = name.trim().toLowerCase()
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot)
}

export function isGenericMime(type: string): boolean {
  const mime = normalizeMimeType(type)
  return mime === '' || mime === 'application/octet-stream' || mime === 'binary/octet-stream'
}
