import { memo } from 'react'
import { Star } from 'lucide-react'
import { ToolCard } from '@/components/tool/ToolCard'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import { useT } from '@/i18n'
import { useLocalizedTool } from '@/i18n/tools'
import { DISCOVERY_STORAGE_EVENT, useFavoriteIds } from '@/lib/storage/discovery'
import { getFavoriteTools, saveFavoriteTools } from '@/lib/storage/tools'

export const DiscoveryToolCard = memo(function DiscoveryToolCard({ tool, leaving = false }: { tool: ToolDefinition; leaving?: boolean }) {
  const copy = useT()
  const item = useLocalizedTool(tool)
  const favorites = useFavoriteIds()
  const favorite = favorites.includes(tool.id)
  const action = tool.available ? (
    <button
      className={`favorite-button${favorite ? ' active' : ''}`}
      type="button"
      aria-label={favorite ? copy.favorite.remove(item.name) : copy.favorite.add(item.name)}
      aria-pressed={favorite}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const current = getFavoriteTools()
        saveFavoriteTools(favorite ? current.filter((id) => id !== tool.id) : [tool.id, ...current])
        window.dispatchEvent(new Event(DISCOVERY_STORAGE_EVENT))
      }}
    >
      <Star size={16} fill={favorite ? 'currentColor' : 'none'} />
    </button>
  ) : undefined
  return (
    <div className={`discovery-card${leaving ? ' is-leaving' : ''}`} data-flip-id={tool.id}>
      <ToolCard tool={tool} action={action} />
    </div>
  )
}
