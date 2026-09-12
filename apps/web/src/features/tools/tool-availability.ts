export function isToolAvailable(tool: { available: boolean }) {
  return tool.available === true
}

export function partitionByAvailability<T extends { available: boolean }>(items: readonly T[]): {
  available: T[]
  comingSoon: T[]
} {
  const available: T[] = []
  const comingSoon: T[] = []
  for (const item of items) {
    if (isToolAvailable(item)) available.push(item)
    else comingSoon.push(item)
  }
  return { available, comingSoon }
}

export function sortAvailableFirst<T extends { available: boolean }>(items: readonly T[]): T[] {
  const { available, comingSoon } = partitionByAvailability(items)
  return [...available, ...comingSoon]
}

export type ToolAudienceState = 'available' | 'coming-soon' | 'pro-locked' | 'configuration-required'

export function publicToolAudienceState(
  tool: { available: boolean; requiresPro?: boolean },
  entitled = true,
): Exclude<ToolAudienceState, 'configuration-required'> {
  if (!tool.available) return 'coming-soon'
  if (tool.requiresPro && !entitled) return 'pro-locked'
  return 'available'
}
