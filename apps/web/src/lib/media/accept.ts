import { formatsMatchingToken } from './formats'
import { fileExtension, isGenericMime, normalizeMimeType } from './mime'

export function expandAccept(accept: readonly string[]): {
  mimes: Set<string>
  extensions: Set<string>
  wildcards: string[]
} {
  const mimes = new Set<string>()
  const extensions = new Set<string>()
  const wildcards: string[] = []
  for (const raw of accept) {
    const rule = raw.trim().toLowerCase()
    if (!rule) continue
    if (rule.startsWith('.')) {
      extensions.add(rule)
      for (const format of formatsMatchingToken(rule)) {
        for (const mime of format.mimeTypes) mimes.add(mime)
        for (const extension of format.extensions) extensions.add(extension)
      }
      continue
    }
    if (rule.endsWith('/*')) {
      wildcards.push(rule.slice(0, -1))
      if (rule === 'audio/*') {
        for (const format of formatsMatchingToken('audio/webm')) {
          for (const mime of format.mimeTypes) mimes.add(mime)
          for (const extension of format.extensions) extensions.add(extension)
        }
      }
      continue
    }
    mimes.add(rule)
    for (const format of formatsMatchingToken(rule)) {
      for (const mime of format.mimeTypes) mimes.add(mime)
      for (const extension of format.extensions) extensions.add(extension)
    }
  }
  return { mimes, extensions, wildcards }
}

export function fileMatchesMediaAccept(
  file: { name: string; type: string },
  accept: readonly string[],
): boolean {
  if (accept.length === 0) return true
  const { mimes, extensions, wildcards } = expandAccept(accept)
  const ext = fileExtension(file.name)
  if (ext && extensions.has(ext)) return true
  const mime = normalizeMimeType(file.type)
  if (mime && mimes.has(mime)) return true
  if (mime && wildcards.some((prefix) => mime.startsWith(prefix))) return true
  if (isGenericMime(file.type)) return false
  return false
}
