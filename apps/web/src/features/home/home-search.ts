import { z } from 'zod'

export const homeCategories = ['all', 'image', 'qr', 'developer', 'generator', 'text', 'pdf', 'audio', 'video', 'converter'] as const
export const homeGroups = ['all', 'optimize', 'create', 'edit', 'convert', 'security'] as const
export type CategoryFilter = typeof homeCategories[number]
export type GroupFilter = typeof homeGroups[number]

export const homeSearchSchema = z.object({
  q: z.string().catch('').default(''),
  category: z.enum(homeCategories).catch('all').default('all'),
  group: z.enum(homeGroups).catch('all').default('all'),
})
