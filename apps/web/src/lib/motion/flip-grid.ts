export interface FlipRenderItem<T> {
  item: T
  leaving: boolean
}

export function planFlipRender<T>(previous: readonly FlipRenderItem<T>[], next: readonly T[], idOf: (item: T) => string): FlipRenderItem<T>[] {
  const nextIds = new Set(next.map(idOf))
  const live = next.map((item) => ({ item, leaving: false }))
  const leaving = previous
    .filter((entry) => !entry.leaving && !nextIds.has(idOf(entry.item)))
    .map((entry) => ({ item: entry.item, leaving: true }))
  return [...live, ...leaving]
}

export function liveItems<T>(entries: readonly FlipRenderItem<T>[]) {
  return entries.filter((entry) => !entry.leaving).map((entry) => entry.item)
}

export function itemSignature<T>(items: readonly T[], idOf: (item: T) => string) {
  return items.map(idOf).join('\0')
}
