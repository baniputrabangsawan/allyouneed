import type { ComponentType } from 'react'
import { BasicBackgroundWorkspace } from '../image/BasicBackgroundWorkspace'
import { HtmlToImageWorkspace } from '../image/HtmlToImageWorkspace'
import { MergePngWorkspace } from '../image/MergePngWorkspace'
import type { ToolDefinition, ToolImplementation } from '../tools/tool-registry'
import { BrowserMediaWorkspace } from './BrowserMediaWorkspace'
import { ColorWorkspace } from './ColorWorkspace'
import { CryptoWorkspace } from './CryptoWorkspace'
import { CssWorkspace } from './CssWorkspace'
import { DateTimeWorkspace } from './DateTimeWorkspace'
import { EncodingWorkspace } from './EncodingWorkspace'
import { GenericTextWorkspace } from './GenericTextWorkspace'
import { HtmlWorkspace } from './HtmlWorkspace'
import { JavaScriptWorkspace } from './JavaScriptWorkspace'
import { JsonWorkspace } from './JsonWorkspace'
import { QrisParserWorkspace } from './QrisParserWorkspace'
import { QrWorkspace } from './QrWorkspace'
import { RandomWorkspace } from './RandomWorkspace'
import { AudioConverterWorkspace } from './AudioConverterWorkspace'
import { RemoteFileWorkspace } from './RemoteFileWorkspace'
import { SpeechToTextWorkspace } from './SpeechToTextWorkspace'
import { TextToSpeechWorkspace } from './TextToSpeechWorkspace'
import { WordCounterWorkspace } from './WordCounterWorkspace'
import { XmlWorkspace } from './XmlWorkspace'
import { YamlWorkspace } from './YamlWorkspace'

export { BasicBackgroundWorkspace } from '../image/BasicBackgroundWorkspace'
export { MergePngWorkspace } from '../image/MergePngWorkspace'
export { BrowserMediaWorkspace } from './BrowserMediaWorkspace'
export { ColorWorkspace } from './ColorWorkspace'
export { CryptoWorkspace } from './CryptoWorkspace'
export { CssWorkspace } from './CssWorkspace'
export { DateTimeWorkspace } from './DateTimeWorkspace'
export { EncodingWorkspace } from './EncodingWorkspace'
export { GenericTextWorkspace } from './GenericTextWorkspace'
export { HtmlWorkspace } from './HtmlWorkspace'
export { JavaScriptWorkspace } from './JavaScriptWorkspace'
export { JsonWorkspace } from './JsonWorkspace'
export { QrisParserWorkspace } from './QrisParserWorkspace'
export { QrWorkspace } from './QrWorkspace'
export { RandomWorkspace } from './RandomWorkspace'
export { AudioConverterWorkspace } from './AudioConverterWorkspace'
export { RemoteFileWorkspace } from './RemoteFileWorkspace'
export { SpeechToTextWorkspace } from './SpeechToTextWorkspace'
export { TextToSpeechWorkspace } from './TextToSpeechWorkspace'
export { WordCounterWorkspace } from './WordCounterWorkspace'
export { XmlWorkspace } from './XmlWorkspace'
export { YamlWorkspace } from './YamlWorkspace'
export * from './focused-workspace-utils'
export * from './workspace-slugs'

export type WorkspaceComponent = ComponentType<{ tool: ToolDefinition }>

export const workspaceComponents = {
  text: GenericTextWorkspace,
  json: JsonWorkspace,
  xml: XmlWorkspace,
  yaml: YamlWorkspace,
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
  if (tool.slug === 'javascript-formatter') return JavaScriptWorkspace
  if (tool.slug === 'html-formatter') return HtmlWorkspace
  if (tool.slug === 'html-to-image') return HtmlToImageWorkspace
  if (tool.slug === 'basic-background-removal') return BasicBackgroundWorkspace
  if (tool.slug === 'audio-converter') return AudioConverterWorkspace
  if (tool.slug === 'speech-to-text') return SpeechToTextWorkspace
  if (tool.slug === 'text-to-speech') return TextToSpeechWorkspace
  if (tool.slug === 'merge-png') return MergePngWorkspace
}

export function getWorkspaceComponent(tool: ToolDefinition): WorkspaceComponent | undefined {
  const special = getSpecialWorkspace(tool)
  if (special) return special
  return workspaceComponents[tool.implementation as keyof typeof workspaceComponents]
}
