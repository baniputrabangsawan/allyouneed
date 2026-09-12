import { describe, expect, it } from 'vitest'
import { getImageWorkspaceMode } from '../image/image-utils'
import { getWorkspaceComponent } from '../workspaces'
import { getLazyWorkspace } from '../workspaces/lazy-workspaces'
import { getToolBySlug, tools } from './tool-registry'

const unavailableAi = [
  'upscale-image',
  'ocr-pdf',
  'background-blur',
  'replace-background',
] as const

const remoteProcessors = new Set([
  'compress-pdf', 'merge-pdf', 'split-pdf', 'jpg-to-pdf', 'png-to-pdf', 'pdf-to-jpg', 'pdf-to-png',
  'rotate-pdf', 'delete-pdf-pages', 'reorder-pdf-pages', 'extract-pdf-pages', 'watermark-pdf',
  'page-number-pdf', 'protect-pdf', 'unlock-pdf', 'pdf-metadata-viewer', 'pdf-to-text',
  'change-audio-speed', 'change-volume', 'audio-converter', 'audio-compressor', 'audio-cutter',
  'audio-trimmer', 'audio-merger', 'remove-silence', 'noise-reduction', 'extract-audio-from-video', 'video-compressor',
  'video-converter', 'video-to-gif', 'gif-to-video', 'video-cutter', 'video-trimmer', 'video-merger',
  'resize-video', 'crop-video', 'rotate-video', 'remove-audio', 'extract-audio', 'add-audio',
  'change-video-speed', 'add-watermark', 'blur-face', 'html-to-image', 'basic-background-removal',
  'speech-to-text', 'text-to-speech', 'remove-background',
])

describe('available-tool contract', () => {
  it('requires a real workspace or image mode for every available tool', () => {
    const available = tools.filter((tool) => tool.available)
    expect(available.length).toBeGreaterThan(0)
    for (const tool of available) {
      expect(getToolBySlug(tool.slug), tool.slug).toBe(tool)
      expect(getLazyWorkspace(tool), tool.slug).toBeDefined()
      expect(tool.implementation, tool.slug).not.toBe('dependency-required')
      if (tool.implementation === 'image-canvas') {
        expect(getImageWorkspaceMode(tool.slug), tool.slug).not.toBeNull()
        continue
      }
      expect(getWorkspaceComponent(tool), tool.slug).toBeTypeOf('function')
      if (tool.implementation === 'remote-api') {
        expect(remoteProcessors.has(tool.slug), tool.slug).toBe(true)
        expect(unavailableAi, tool.slug).not.toContain(tool.slug)
      }
    }
  })

  it('keeps incomplete, AI, and dependency-required tools Coming Soon', () => {
    for (const slug of [...unavailableAi, 'add-subtitle']) {
      expect(getToolBySlug(slug)?.available, slug).toBe(false)
    }
    for (const tool of tools.filter((item) => item.implementation === 'dependency-required')) {
      expect(tool.available, tool.slug).toBe(false)
    }
  })
})
