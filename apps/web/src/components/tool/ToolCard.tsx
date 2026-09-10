import { Link } from '@tanstack/react-router'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ToolDefinition } from '@/features/tools/tool-registry'

const iconMap: Record<string, LucideIcon> = {
  ImageDown: Icons.ImageDown, Scaling: Icons.Scaling, RotateCw: Icons.RotateCw,
  RefreshCw: Icons.RefreshCw, Stamp: Icons.Stamp, ScanLine: Icons.ScanLine,
  QrCode: Icons.QrCode, Braces: Icons.Braces, Binary: Icons.Binary,
  Fingerprint: Icons.Fingerprint, KeyRound: Icons.KeyRound, TextCursorInput: Icons.TextCursorInput,
  Files: Icons.Files, AudioLines: Icons.AudioLines, Video: Icons.Video,
}

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const Icon = iconMap[tool.icon] ?? Icons.Wrench
  const badge = !tool.available
    ? <span className="badge soon">Coming soon</span>
    : tool.accessTier === 'pro' || tool.premium
      ? <span className="badge pro">Pro</span>
      : tool.new
        ? <span className="badge">New</span>
        : null
  const content = <><div className="tool-card-top"><span className={`tool-icon ${tool.category}`}><Icon size={21} /></span>{badge}</div><h3>{tool.name}</h3><p>{tool.shortDescription}</p><div className="tool-meta"><span>{tool.category}</span><span>·</span><span>{tool.groups[0]}</span><span>·</span><span>{tool.processingMode === 'client' ? 'Local' : 'Server'}</span></div></>
  return <Link to="/$tool" params={{ tool: tool.slug }} className={`tool-card${tool.available ? '' : ' disabled'}`} aria-disabled={tool.available ? undefined : true} aria-label={tool.available ? undefined : `${tool.name}, coming soon`}>{content}</Link>
}
