import { useEffect, useState } from 'react'

export function syncObjectUrls(
  current: ReadonlyMap<File, string>,
  files: readonly File[],
  create: (file: File) => string = (file) => URL.createObjectURL(file),
  revoke: (url: string) => void = (url) => URL.revokeObjectURL(url),
): Map<File, string> {
  const next = new Map<File, string>()
  for (const file of files) {
    const existing = current.get(file)
    next.set(file, existing ?? create(file))
  }
  for (const [file, url] of current) {
    if (!next.has(file)) revoke(url)
  }
  return next
}

export function useObjectUrl(source: Blob | File | null | undefined): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!source) {
      setUrl('')
      return
    }
    const next = URL.createObjectURL(source)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [source])
  return url
}

export function useObjectUrls(files: readonly File[]): string[] {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const created = files.map((file) => URL.createObjectURL(file))
    setUrls(created)
    return () => {
      for (const url of created) URL.revokeObjectURL(url)
    }
  }, [files])
  return urls
}
