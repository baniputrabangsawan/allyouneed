import { DiscoveryToolCard } from '@/components/common/DiscoveryToolCard'
import type { ToolDefinition } from '@/features/tools/tool-registry'

export function HorizontalToolList({
  items,
  label,
}: {
  items: readonly ToolDefinition[]
  label?: string
}) {
  return (
    <div className="tool-grid tool-rail" role="list" aria-label={label}>
      {items.map((tool) => (
        <div key={tool.id} className="tool-rail-item" role="listitem">
          <DiscoveryToolCard tool={tool} />
        </div>
      ))}
    </div>
  )
}
