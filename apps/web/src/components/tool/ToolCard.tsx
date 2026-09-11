import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ToolDefinition } from '@/features/tools/tool-registry'
import { LocaleLink } from '@/i18n/link'
import { useT } from '@/i18n'
import { useLocalizedTool } from '@/i18n/tools'

const iconMap: Record<string, LucideIcon> = {
  ImageDown: Icons.ImageDown, Scaling: Icons.Scaling, RotateCw: Icons.RotateCw,
  RefreshCw: Icons.RefreshCw, Stamp: Icons.Stamp, ScanLine: Icons.ScanLine,
  QrCode: Icons.QrCode, Braces: Icons.Braces, Binary: Icons.Binary,
  Fingerprint: Icons.Fingerprint, KeyRound: Icons.KeyRound, TextCursorInput: Icons.TextCursorInput,
  Files: Icons.Files, AudioLines: Icons.AudioLines, Video: Icons.Video,
}

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const item = useLocalizedTool(tool)
  const Icon = iconMap[tool.icon] ?? Icons.Wrench
  const badge = !tool.available
    ? <span className="badge soon">{copy.availability.comingSoonBadge}</span>
    : tool.accessTier === 'pro' || tool.premium
      ? <span className="badge pro">{copy.availability.pro}</span>
      : tool.new
        ? <span className="badge">{copy.availability.new}</span>
        : null
  const categoryLabel = copy.category[tool.category] ?? tool.category
  const groupLabel = tool.groups[0] ? (copy.group[tool.groups[0]] ?? tool.groups[0]) : ''
  const content = <><div className="tool-card-top"><span className={`tool-icon ${tool.category}`}><Icon size={21} /></span>{badge}</div><h3>{item.name}</h3><p>{item.shortDescription}</p><div className="tool-meta"><span>{categoryLabel}</span><span>·</span><span>{groupLabel}</span><span>·</span><span>{tool.processingMode === 'client' ? copy.availability.local : copy.availability.server}</span></div></>
  return <LocaleLink to="/$tool" params={{ tool: tool.slug }} className={`tool-card${tool.available ? '' : ' disabled'}`} aria-disabled={tool.available ? undefined : true} aria-label={tool.available ? undefined : copy.availability.comingSoonAria(item.name)}>{content}</LocaleLink>
}
