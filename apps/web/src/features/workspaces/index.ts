import type { ComponentType } from 'react'
import type { ToolDefinition, ToolImplementation } from '../tools/tool-registry'
import { BrowserMediaWorkspace } from './BrowserMediaWorkspace'
import { ColorWorkspace } from './ColorWorkspace'
import { CryptoWorkspace } from './CryptoWorkspace'
import { CssWorkspace } from './CssWorkspace'
import { DateTimeWorkspace } from './DateTimeWorkspace'
import { EncodingWorkspace } from './EncodingWorkspace'
import { GenericTextWorkspace } from './GenericTextWorkspace'
import { JsonWorkspace } from './JsonWorkspace'
import { QrisParserWorkspace } from './QrisParserWorkspace'
import { QrWorkspace } from './QrWorkspace'
import { RandomWorkspace } from './RandomWorkspace'
import { RemoteFileWorkspace } from './RemoteFileWorkspace'
import { WordCounterWorkspace } from './WordCounterWorkspace'

export { BrowserMediaWorkspace } from './BrowserMediaWorkspace'
export { ColorWorkspace } from './ColorWorkspace'
export { CryptoWorkspace } from './CryptoWorkspace'
export { CssWorkspace } from './CssWorkspace'
export { DateTimeWorkspace } from './DateTimeWorkspace'
export { EncodingWorkspace } from './EncodingWorkspace'
export { GenericTextWorkspace } from './GenericTextWorkspace'
export { JsonWorkspace } from './JsonWorkspace'
export { QrisParserWorkspace } from './QrisParserWorkspace'
export { QrWorkspace } from './QrWorkspace'
export { RandomWorkspace } from './RandomWorkspace'
export { RemoteFileWorkspace } from './RemoteFileWorkspace'
export { WordCounterWorkspace } from './WordCounterWorkspace'
export * from './focused-workspace-utils'
export * from './workspace-slugs'

export type WorkspaceComponent = ComponentType<{ tool: ToolDefinition }>

export const workspaceComponents = {
  text: GenericTextWorkspace,
  json: JsonWorkspace,
  'qr-code': QrWorkspace,
  encoding: EncodingWorkspace,
  crypto: CryptoWorkspace,
  random: RandomWorkspace,
  'date-time': DateTimeWorkspace,
  color: ColorWorkspace,
  css: CssWorkspace,
  'browser-media': BrowserMediaWorkspace,
  'remote-api': RemoteFileWorkspace,
} satisfies Partial<Record<ToolImplementation, WorkspaceComponent>>

export function getSpecialWorkspace(tool: ToolDefinition): WorkspaceComponent | undefined {
  if (tool.slug === 'word-counter' || tool.slug === 'character-counter') return WordCounterWorkspace
  if (tool.slug === 'qris-payload-parser') return QrisParserWorkspace
}

export function getWorkspaceComponent(tool: ToolDefinition): WorkspaceComponent | undefined {
  const special = getSpecialWorkspace(tool)
  if (special) return special
  return workspaceComponents[tool.implementation as keyof typeof workspaceComponents]
}
