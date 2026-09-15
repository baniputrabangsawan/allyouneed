import { memo, type ReactNode } from 'react'
import {
  AudioLines,
  Braces,
  Calculator,
  CalendarClock,
  ChartColumn,
  CircleDollarSign,
  Code2,
  Divide,
  FileText,
  Image,
  Monitor,
  Palette,
  Percent,
  QrCode,
  RefreshCw,
  Ruler,
  Sigma,
  TextCursorInput,
  TrendingUp,
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
  Calculator,
  Sigma,
  CircleDollarSign,
  TrendingUp,
  Ruler,
  Percent,
  CalendarClock,
  Code2,
  ChartColumn,
  Divide,
  Monitor,
  Palette,
}

export const ToolCard = memo(function ToolCard({ tool, action }: { tool: ToolDefinition; action?: ReactNode }) {
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
  return (
    <div className={`tool-card${tool.available ? '' : ' disabled'}`}>
      <div className="tool-card-top">
        <span className={`tool-icon ${tool.category}`}><Icon size={21} /></span>
        {(badge || action) ? (
          <div className="tool-card-actions">
            {badge}
            {action}
          </div>
        ) : null}
      </div>
      <h3>
        <LocaleLink
          to="/tools/$category"
          params={{ category: tool.slug }}
          className="tool-card-link"
          aria-disabled={tool.available ? undefined : true}
          aria-label={tool.available ? undefined : copy.availability.comingSoonAria(item.name)}
        >
          {item.name}
        </LocaleLink>
      </h3>
      <p>{item.shortDescription}</p>
      <div className="tool-meta">
        <span>{categoryLabel}</span>
        <span>·</span>
        <span>{groupLabel}</span>
        <span>·</span>
        <span>{tool.processingMode === 'client' ? copy.availability.local : copy.availability.server}</span>
      </div>
    </div>
  )
})
