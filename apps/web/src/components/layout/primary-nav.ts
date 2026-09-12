export const explorerSearch = { q: '', category: 'all', group: 'all' } as const

export const primaryNav = [
  { key: 'tools', hash: 'all-tools' },
  { key: 'favorites', hash: 'favorites' },
  { key: 'recent', hash: 'recent' },
  { key: 'new', hash: 'new' },
] as const

export const pageNav = [
  { key: 'docs', to: '/docs' },
  { key: 'pricing', to: '/pricing' },
] as const
