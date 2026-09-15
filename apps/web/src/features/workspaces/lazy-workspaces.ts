import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { ToolDefinition, ToolImplementation } from '@/features/tools/tool-registry'
import { recoverFromChunkLoadError } from '@/lib/chunk-reload'

type WorkspaceComponent = ComponentType<{ tool: ToolDefinition }>
type LazyWorkspace = LazyExoticComponent<WorkspaceComponent>

function workspace(
  load: () => Promise<Record<string, unknown>>,
  exportName: string,
): LazyWorkspace {
  return lazy(async () => {
    try {
      const module = await load()
      return { default: module[exportName] as WorkspaceComponent }
    } catch (error) {
      recoverFromChunkLoadError(error)
      throw error
    }
  })
}

const implementationWorkspaces: Partial<Record<ToolImplementation, LazyWorkspace>> = {
  text: workspace(() => import('./GenericTextWorkspace'), 'GenericTextWorkspace'),
  json: workspace(() => import('./JsonWorkspace'), 'JsonWorkspace'),
  xml: workspace(() => import('./XmlWorkspace'), 'XmlWorkspace'),
  yaml: workspace(() => import('./YamlWorkspace'), 'YamlWorkspace'),
  'qr-code': workspace(() => import('./QrWorkspace'), 'QrWorkspace'),
  encoding: workspace(() => import('./EncodingWorkspace'), 'EncodingWorkspace'),
  crypto: workspace(() => import('./CryptoWorkspace'), 'CryptoWorkspace'),
  random: workspace(() => import('./RandomWorkspace'), 'RandomWorkspace'),
  'date-time': workspace(() => import('./DateTimeWorkspace'), 'DateTimeWorkspace'),
  color: workspace(() => import('./ColorWorkspace'), 'ColorWorkspace'),
  css: workspace(() => import('./CssWorkspace'), 'CssWorkspace'),
  'browser-media': workspace(() => import('./BrowserMediaWorkspace'), 'BrowserMediaWorkspace'),
  'remote-api': workspace(() => import('./RemoteFileWorkspace'), 'RemoteFileWorkspace'),
  'image-canvas': workspace(() => import('../image/ImageWorkspace'), 'ImageWorkspace'),
}

const specialWorkspaces: Record<string, LazyWorkspace> = {
  'word-counter': workspace(() => import('./WordCounterWorkspace'), 'WordCounterWorkspace'),
  'standard-calculator': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'scientific-calculator': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'currency-converter': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'finance-calculator': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'unit-converter': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'percentage-calculator': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'date-time-calculator': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'programmer-calculator': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'statistics-calculator': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'fractions-calculator': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'screen-calculator': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'color-calculator': workspace(() => import('../calculator/UniversalCalculatorWorkspace'), 'CalculatorWorkspace'),
  'qris-payload-parser': workspace(() => import('./QrisParserWorkspace'), 'QrisParserWorkspace'),
  'javascript-formatter': workspace(() => import('./JavaScriptWorkspace'), 'JavaScriptWorkspace'),
  'html-formatter': workspace(() => import('./HtmlWorkspace'), 'HtmlWorkspace'),
  'csv-json-converter': workspace(() => import('./CsvJsonWorkspace'), 'CsvJsonWorkspace'),
  'json-diff': workspace(() => import('./JsonDiffWorkspace'), 'JsonDiffWorkspace'),
  'color-contrast-checker': workspace(() => import('./ColorContrastWorkspace'), 'ColorContrastWorkspace'),
  'css-clamp-calculator': workspace(() => import('./CssClampWorkspace'), 'CssClampWorkspace'),
  'regex-tester': workspace(() => import('./RegexTesterWorkspace'), 'RegexTesterWorkspace'),
  'meta-tag-generator': workspace(() => import('./MetaTagWorkspace'), 'MetaTagWorkspace'),
  'robots-txt-generator': workspace(() => import('./RobotsTxtWorkspace'), 'RobotsTxtWorkspace'),
  'sitemap-generator': workspace(() => import('./SitemapWorkspace'), 'SitemapWorkspace'),
  'json-ld-generator': workspace(() => import('./JsonLdWorkspace'), 'JsonLdWorkspace'),
  'open-graph-generator': workspace(() => import('./OpenGraphWorkspace'), 'OpenGraphWorkspace'),
  'html-to-image': workspace(() => import('../image/HtmlToImageWorkspace'), 'HtmlToImageWorkspace'),
  'basic-background-removal': workspace(() => import('../image/BasicBackgroundWorkspace'), 'BasicBackgroundWorkspace'),
  'remove-background': workspace(() => import('../image/RemoveBackgroundWorkspace'), 'RemoveBackgroundWorkspace'),
  'audio-converter': workspace(() => import('./AudioConverterWorkspace'), 'AudioConverterWorkspace'),
  'speech-to-text': workspace(() => import('./SpeechToTextWorkspace'), 'SpeechToTextWorkspace'),
  'text-to-speech': workspace(() => import('./TextToSpeechWorkspace'), 'TextToSpeechWorkspace'),
  'svg-to-png': workspace(() => import('../image/SvgToPngWorkspace'), 'SvgToPngWorkspace'),
  'merge-png': workspace(() => import('../image/MergePngWorkspace'), 'MergePngWorkspace'),
}

export function getLazyWorkspace(tool: ToolDefinition): LazyWorkspace | undefined {
  return specialWorkspaces[tool.slug] ?? implementationWorkspaces[tool.implementation]
}
