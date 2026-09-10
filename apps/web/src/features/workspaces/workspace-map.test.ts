import { describe, expect, it } from 'vitest'
import { tools } from '../tools/tool-registry'
import {
  browserMediaWorkspaceSlugs, colorWorkspaceSlugs, cryptoWorkspaceSlugs, cssWorkspaceSlugs,
  dateTimeWorkspaceSlugs, encodingWorkspaceSlugs, genericTextWorkspaceSlugs, getSpecialWorkspace,
  getWorkspaceComponent, QrisParserWorkspace, QrWorkspace, randomWorkspaceSlugs, WordCounterWorkspace,
  workspaceComponents,
} from './index'

describe('workspace component mapping', () => {
  it('exports a component for every implemented workspace class', () => {
    expect(Object.keys(workspaceComponents).sort()).toEqual(['browser-media', 'color', 'crypto', 'css', 'date-time', 'encoding', 'json', 'qr-code', 'random', 'remote-api', 'text'])
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
    for (const tool of tools.filter(({ implementation }) => implementation === 'qr-code')) expect(getWorkspaceComponent(tool), tool.slug).toBe(QrWorkspace)
    expect(getSpecialWorkspace(get('word-counter')!)).toBe(WordCounterWorkspace)
    expect(getSpecialWorkspace(get('qris-payload-parser')!)).toBe(QrisParserWorkspace)
  })
})
