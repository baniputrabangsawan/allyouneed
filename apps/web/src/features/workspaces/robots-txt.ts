export type RobotsRuleType = 'Allow' | 'Disallow'

export interface RobotsRule {
  type: RobotsRuleType
  path: string
}

export interface RobotsGroup {
  userAgent: string
  customUserAgent?: string
  rules: RobotsRule[]
  crawlDelay?: string
}

export interface RobotsTxtInput {
  groups: RobotsGroup[]
  sitemapUrl?: string
  advanced?: string
}

export function effectiveUserAgent(group: RobotsGroup): string {
  const value = group.userAgent === 'custom' ? group.customUserAgent : group.userAgent
  return cleanLine(value || '*') || '*'
}

export function generateRobotsTxt(input: RobotsTxtInput): string {
  if (input.advanced !== undefined) return input.advanced.trimEnd()

  const sections = input.groups.map((group) => {
    const lines = [`User-agent: ${effectiveUserAgent(group)}`]
    for (const rule of group.rules) lines.push(`${rule.type}: ${cleanLine(rule.path) || '/'}`)
    const crawlDelay = cleanLine(group.crawlDelay || '')
    if (crawlDelay) lines.push(`Crawl-delay: ${crawlDelay}`)
    return lines.join('\n')
  })

  const sitemapUrl = cleanLine(input.sitemapUrl || '')
  if (sitemapUrl) sections.push(`Sitemap: ${sitemapUrl}`)

  return sections.join('\n\n')
}

export function blocksEntireSite(groups: RobotsGroup[]): boolean {
  return groups.some((group) => effectiveUserAgent(group) === '*' && group.rules.some((rule) => rule.type === 'Disallow' && cleanLine(rule.path) === '/'))
}

function cleanLine(value: string): string {
  return value.replace(/[\r\n]/g, '').trim()
}
