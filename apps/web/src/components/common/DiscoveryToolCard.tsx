import { Star } from 'lucide-react'
import { ToolCard } from '@/components/tool/ToolCard'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import { DISCOVERY_STORAGE_EVENT, useFavoriteIds } from '@/lib/storage/discovery'
import { getFavoriteTools, saveFavoriteTools } from '@/lib/storage/tools'

export function DiscoveryToolCard({ tool, leaving = false }: { tool: ToolDefinition; leaving?: boolean }) {
  const favorites = useFavoriteIds()
  const favorite = favorites.includes(tool.id)
  return <div className={`discovery-card${leaving ? ' is-leaving' : ''}`} data-flip-id={tool.id}><ToolCard tool={tool}/>{tool.available && <button className={`favorite-button${favorite ? ' active' : ''}`} type="button" aria-label={`${favorite ? 'Remove' : 'Add'} ${tool.name} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} onClick={() => {
    const current = getFavoriteTools()
    saveFavoriteTools(favorite ? current.filter((id) => id !== tool.id) : [tool.id, ...current])
    window.dispatchEvent(new Event(DISCOVERY_STORAGE_EVENT))
  }}><Star size={16} fill={favorite ? 'currentColor' : 'none'}/></button>}</div>
}
