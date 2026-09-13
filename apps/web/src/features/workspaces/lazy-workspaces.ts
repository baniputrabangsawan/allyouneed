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
  'character-counter': workspace(() => import('./WordCounterWorkspace'), 'WordCounterWorkspace'),
  'qris-payload-parser': workspace(() => import('./QrisParserWorkspace'), 'QrisParserWorkspace'),
  'javascript-formatter': workspace(() => import('./JavaScriptWorkspace'), 'JavaScriptWorkspace'),
  'html-formatter': workspace(() => import('./HtmlWorkspace'), 'HtmlWorkspace'),
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
