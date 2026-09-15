import type { ComponentType } from 'react'
import { BasicBackgroundWorkspace } from '../image/BasicBackgroundWorkspace'
import { HtmlToImageWorkspace } from '../image/HtmlToImageWorkspace'
import { MergePngWorkspace } from '../image/MergePngWorkspace'
import type { ToolDefinition, ToolImplementation } from '../tools/tool-registry'
import { BrowserMediaWorkspace } from './BrowserMediaWorkspace'
import { ColorWorkspace } from './ColorWorkspace'
import { ColorContrastWorkspace } from './ColorContrastWorkspace'
import { CryptoWorkspace } from './CryptoWorkspace'
import { CsvJsonWorkspace } from './CsvJsonWorkspace'
import { CssClampWorkspace } from './CssClampWorkspace'
import { CssWorkspace } from './CssWorkspace'
import { DateTimeWorkspace } from './DateTimeWorkspace'
import { EncodingWorkspace } from './EncodingWorkspace'
import { GenericTextWorkspace } from './GenericTextWorkspace'
import { HtmlWorkspace } from './HtmlWorkspace'
import { JavaScriptWorkspace } from './JavaScriptWorkspace'
import { JsonLdWorkspace } from './JsonLdWorkspace'
import { JsonDiffWorkspace } from './JsonDiffWorkspace'
import { JsonWorkspace } from './JsonWorkspace'
import { MetaTagWorkspace } from './MetaTagWorkspace'
import { OpenGraphWorkspace } from './OpenGraphWorkspace'
import { QrisParserWorkspace } from './QrisParserWorkspace'
import { QrWorkspace } from './QrWorkspace'
import { RandomWorkspace } from './RandomWorkspace'
import { RegexTesterWorkspace } from './RegexTesterWorkspace'
import { AudioConverterWorkspace } from './AudioConverterWorkspace'
import { RemoteFileWorkspace } from './RemoteFileWorkspace'
import { RobotsTxtWorkspace } from './RobotsTxtWorkspace'
import { SitemapWorkspace } from './SitemapWorkspace'
import { SpeechToTextWorkspace } from './SpeechToTextWorkspace'
import { TextToSpeechWorkspace } from './TextToSpeechWorkspace'
import { WordCounterWorkspace } from './WordCounterWorkspace'
import { XmlWorkspace } from './XmlWorkspace'
import { YamlWorkspace } from './YamlWorkspace'

export { BasicBackgroundWorkspace } from '../image/BasicBackgroundWorkspace'
export { MergePngWorkspace } from '../image/MergePngWorkspace'
export { BrowserMediaWorkspace } from './BrowserMediaWorkspace'
export { ColorWorkspace } from './ColorWorkspace'
export { ColorContrastWorkspace } from './ColorContrastWorkspace'
export { CryptoWorkspace } from './CryptoWorkspace'
export { CsvJsonWorkspace } from './CsvJsonWorkspace'
export { CssClampWorkspace } from './CssClampWorkspace'
export { CssWorkspace } from './CssWorkspace'
export { DateTimeWorkspace } from './DateTimeWorkspace'
export { EncodingWorkspace } from './EncodingWorkspace'
export { GenericTextWorkspace } from './GenericTextWorkspace'
export { HtmlWorkspace } from './HtmlWorkspace'
export { JavaScriptWorkspace } from './JavaScriptWorkspace'
export { JsonLdWorkspace } from './JsonLdWorkspace'
export { JsonDiffWorkspace } from './JsonDiffWorkspace'
export { JsonWorkspace } from './JsonWorkspace'
export { MetaTagWorkspace } from './MetaTagWorkspace'
export { OpenGraphWorkspace } from './OpenGraphWorkspace'
export { QrisParserWorkspace } from './QrisParserWorkspace'
export { QrWorkspace } from './QrWorkspace'
export { RandomWorkspace } from './RandomWorkspace'
export { RegexTesterWorkspace } from './RegexTesterWorkspace'
export { AudioConverterWorkspace } from './AudioConverterWorkspace'
export { RemoteFileWorkspace } from './RemoteFileWorkspace'
export { RobotsTxtWorkspace } from './RobotsTxtWorkspace'
export { SitemapWorkspace } from './SitemapWorkspace'
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
  if (tool.slug === 'word-counter') return WordCounterWorkspace
  if (tool.slug === 'qris-payload-parser') return QrisParserWorkspace
  if (tool.slug === 'javascript-formatter') return JavaScriptWorkspace
  if (tool.slug === 'html-formatter') return HtmlWorkspace
  if (tool.slug === 'csv-json-converter') return CsvJsonWorkspace
  if (tool.slug === 'json-diff') return JsonDiffWorkspace
  if (tool.slug === 'color-contrast-checker') return ColorContrastWorkspace
  if (tool.slug === 'css-clamp-calculator') return CssClampWorkspace
  if (tool.slug === 'regex-tester') return RegexTesterWorkspace
  if (tool.slug === 'meta-tag-generator') return MetaTagWorkspace
  if (tool.slug === 'robots-txt-generator') return RobotsTxtWorkspace
  if (tool.slug === 'sitemap-generator') return SitemapWorkspace
  if (tool.slug === 'json-ld-generator') return JsonLdWorkspace
  if (tool.slug === 'open-graph-generator') return OpenGraphWorkspace
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
