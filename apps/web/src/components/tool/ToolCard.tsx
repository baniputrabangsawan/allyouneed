import {
  AudioLines,
  Braces,
  FileText,
  Image,
  QrCode,
  RefreshCw,
  TextCursorInput,
  Video,
  WandSparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import { LocaleLink } from '@/i18n/link'
import { useT } from '@/i18n'
import { useLocalizedTool } from '@/i18n/tools'

const iconMap: Record<string, LucideIcon> = {
  Image,
  QrCode,
  FileText,
  AudioLines,
  Video,
  TextCursorInput,
  Braces,
  WandSparkles,
  RefreshCw,
}

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const item = useLocalizedTool(tool)
  const Icon = iconMap[tool.icon] ?? Wrench
  const badge = !tool.available
    ? <span className="badge soon">{copy.availability.comingSoonBadge}</span>
    : tool.requiresPro
      ? <span className="badge pro">{copy.availability.pro}</span>
      : tool.new
        ? <span className="badge">{copy.availability.new}</span>
        : null
  const categoryLabel = copy.category[tool.category] ?? tool.category
  const groupLabel = tool.groups[0] ? (copy.group[tool.groups[0]] ?? tool.groups[0]) : ''
  const content = (
    <>
      <div className="tool-card-top">
        <span className={`tool-icon ${tool.category}`}><Icon size={21} /></span>
        {badge}
      </div>
      <h3>{item.name}</h3>
      <p>{item.shortDescription}</p>
      <div className="tool-meta">
        <span>{categoryLabel}</span>
        <span>·</span>
        <span>{groupLabel}</span>
        <span>·</span>
        <span>{tool.processingMode === 'client' ? copy.availability.local : copy.availability.server}</span>
      </div>
    </>
  )
  return <LocaleLink to="/tools/$category" params={{ category: tool.slug }} className={`tool-card${tool.available ? '' : ' disabled'}`} aria-disabled={tool.available ? undefined : true} aria-label={tool.available ? undefined : copy.availability.comingSoonAria(item.name)}>{content}</LocaleLink>
}
