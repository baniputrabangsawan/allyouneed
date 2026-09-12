import { describe, expect, it } from 'vitest'
import { tools } from '../tools/tool-registry'
import {
  AudioConverterWorkspace,
  browserMediaWorkspaceSlugs, colorWorkspaceSlugs, cryptoWorkspaceSlugs, cssWorkspaceSlugs,
  dateTimeWorkspaceSlugs, encodingWorkspaceSlugs, genericTextWorkspaceSlugs, getSpecialWorkspace,
  getWorkspaceComponent, HtmlWorkspace, JavaScriptWorkspace, MergePngWorkspace, QrisParserWorkspace, QrWorkspace, randomWorkspaceSlugs, RemoteFileWorkspace, SpeechToTextWorkspace, TextToSpeechWorkspace, WordCounterWorkspace,
  workspaceComponents, YamlWorkspace,
} from './index'

describe('workspace component mapping', () => {
  it('exports a component for every implemented workspace class', () => {
    expect(Object.keys(workspaceComponents).sort()).toEqual(['browser-media', 'color', 'crypto', 'css', 'date-time', 'encoding', 'json', 'qr-code', 'random', 'remote-api', 'text', 'xml', 'yaml'])
  })

  it('dispatches all declared simple tool slugs', () => {
    const slugs = [
      ...browserMediaWorkspaceSlugs, ...colorWorkspaceSlugs, ...cryptoWorkspaceSlugs,
      ...cssWorkspaceSlugs, ...dateTimeWorkspaceSlugs, ...encodingWorkspaceSlugs,
      ...genericTextWorkspaceSlugs, ...randomWorkspaceSlugs,
    ]
    for (const slug of slugs) {
      const tool = tools.find((candidate) => candidate.slug === slug)
      expect(tool, slug).toBeDefined()
      expect(tool && getWorkspaceComponent(tool), slug).toBeTypeOf('function')
    }
  })

  it('dispatches focused and colliding implementations', () => {
    const get = (slug: string) => tools.find((tool) => tool.slug === slug)
    expect(getWorkspaceComponent(get('json-formatter')!)).toBeTypeOf('function')
    expect(getWorkspaceComponent(get('xml-formatter')!)).toBeTypeOf('function')
    expect(getWorkspaceComponent(get('javascript-formatter')!)).toBeTypeOf('function')
    expect(getSpecialWorkspace(get('javascript-formatter')!)).toBe(JavaScriptWorkspace)
    expect(getWorkspaceComponent(get('html-formatter')!)).toBeTypeOf('function')
    expect(getSpecialWorkspace(get('html-formatter')!)).toBe(HtmlWorkspace)
    expect(getWorkspaceComponent(get('html-to-image')!)).toBeTypeOf('function')
    expect(getWorkspaceComponent(get('yaml-to-json')!)).toBe(YamlWorkspace)
    expect(getWorkspaceComponent(get('json-to-yaml')!)).toBe(YamlWorkspace)
    for (const tool of tools.filter(({ implementation }) => implementation === 'qr-code')) expect(getWorkspaceComponent(tool), tool.slug).toBe(QrWorkspace)
    expect(getSpecialWorkspace(get('word-counter')!)).toBe(WordCounterWorkspace)
    expect(getSpecialWorkspace(get('qris-payload-parser')!)).toBe(QrisParserWorkspace)
    expect(getSpecialWorkspace(get('basic-background-removal')!)).toBeTypeOf('function')
    expect(getSpecialWorkspace(get('audio-converter')!)).toBe(AudioConverterWorkspace)
    expect(getWorkspaceComponent(get('audio-converter')!)).toBe(AudioConverterWorkspace)
    expect(getSpecialWorkspace(get('merge-png')!)).toBe(MergePngWorkspace)
    expect(getWorkspaceComponent(get('merge-png')!)).toBe(MergePngWorkspace)
    expect(getWorkspaceComponent(get('noise-reduction')!)).toBe(RemoteFileWorkspace)
    expect(getWorkspaceComponent(get('add-subtitle')!)).toBe(RemoteFileWorkspace)
    expect(getSpecialWorkspace(get('speech-to-text')!)).toBe(SpeechToTextWorkspace)
    expect(getWorkspaceComponent(get('speech-to-text')!)).toBe(SpeechToTextWorkspace)
    expect(getSpecialWorkspace(get('text-to-speech')!)).toBe(TextToSpeechWorkspace)
    expect(getWorkspaceComponent(get('text-to-speech')!)).toBe(TextToSpeechWorkspace)
  })
})
