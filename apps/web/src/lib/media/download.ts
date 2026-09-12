export function triggerDownload(href: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
