export const LICENSE_KEY_PATTERN =
  /^UTL-PRO-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

export const normalizeLicenseKey = (value: string) => {
  const compact = value.trim().toUpperCase().replace(/[\s-]/g, '')
  if (compact.startsWith('UTLPRO') && compact.length === 18) {
    const body = compact.slice(6)
    return `UTL-PRO-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`
  }
  return value.trim().toUpperCase()
}

export const isLicenseKey = (value: unknown): value is string =>
  typeof value === 'string' && LICENSE_KEY_PATTERN.test(normalizeLicenseKey(value))
