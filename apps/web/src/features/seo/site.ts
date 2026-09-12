export const SITE_URL = 'https://usekits.online'
export const SITE_NAME = 'Kits'
export const SOCIAL_IMAGE = `${SITE_URL}/og/kits-tools.png`

export function absoluteUrl(path: string) {
  if (path.startsWith('http')) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export function seoImage() {
  return SOCIAL_IMAGE
}
