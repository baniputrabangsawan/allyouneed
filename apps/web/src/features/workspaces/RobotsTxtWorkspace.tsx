import { useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { CopyButton, DownloadButton } from './workspace-ui'
import { blocksEntireSite, generateRobotsTxt, type RobotsGroup, type RobotsRuleType } from './robots-txt'

const defaultGroups: RobotsGroup[] = [
  { userAgent: '*', rules: [{ type: 'Allow', path: '/' }, { type: 'Disallow', path: '/admin/' }, { type: 'Disallow', path: '/api/' }] },
]

const cloneDefaultGroups = () => defaultGroups.map((group) => ({ ...group, rules: group.rules.map((rule) => ({ ...rule })) }))

export function RobotsTxtWorkspace({ tool }: { tool: ToolDefinition }) {
  const [groups, setGroups] = useState<RobotsGroup[]>(cloneDefaultGroups)
  const [sitemapUrl, setSitemapUrl] = useState('https://example.com/sitemap.xml')
  const [advancedMode, setAdvancedMode] = useState(false)
  const [advanced, setAdvanced] = useState('')
  const robotsTxt = generateRobotsTxt(advancedMode ? { groups, sitemapUrl, advanced } : { groups, sitemapUrl })
  const dangerous = blocksEntireSite(groups) || /^User-agent:\s*\*\s*\nDisallow:\s*\/\s*$/im.test(robotsTxt)

  function reset() {
    setGroups(cloneDefaultGroups())
    setSitemapUrl('https://example.com/sitemap.xml')
    setAdvancedMode(false)
    setAdvanced('')
  }

  function updateGroup(index: number, patch: Partial<RobotsGroup>) {
    setGroups((current) => current.map((group, i) => i === index ? { ...group, ...patch } : group))
  }

  function updateRule(groupIndex: number, ruleIndex: number, patch: { type?: RobotsRuleType; path?: string }) {
    setGroups((current) => current.map((group, i) => i === groupIndex ? { ...group, rules: group.rules.map((rule, j) => j === ruleIndex ? { ...rule, ...patch } : rule) } : group))
  }

  return (
    <section className="workspace split-workspace" aria-label={tool.name}>
      <div className="options-panel">
        <div className="panel-label"><span>Rule builder</span><button className="text-button" type="button" onClick={() => setAdvancedMode(!advancedMode)}>{advancedMode ? 'Builder mode' : 'Advanced mode'}</button></div>
        {advancedMode ? (
          <label className="counter-editor">
            <span>robots.txt syntax</span>
            <textarea value={advanced} spellCheck={false} onChange={(event) => setAdvanced(event.target.value)} placeholder="User-agent: *&#10;Disallow: /admin/" />
          </label>
        ) : (
          <>
            {groups.map((group, groupIndex) => (
              <div className="robots-group" key={groupIndex}>
                <div className="field-grid">
                  <label className="field">
                    <span>User-agent</span>
                    <select value={group.userAgent} onChange={(event) => updateGroup(groupIndex, { userAgent: event.target.value })}>
                      <option value="*">*</option>
                      <option value="Googlebot">Googlebot</option>
                      <option value="Bingbot">Bingbot</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  {group.userAgent === 'custom' ? <label className="field"><span>Custom bot</span><input value={group.customUserAgent || ''} onChange={(event) => updateGroup(groupIndex, { customUserAgent: event.target.value })} placeholder="DuckDuckBot" /></label> : null}
                </div>
                {group.rules.map((rule, ruleIndex) => (
                  <div className="field-grid" key={ruleIndex}>
                    <label className="field"><span>Rule</span><select value={rule.type} onChange={(event) => updateRule(groupIndex, ruleIndex, { type: event.target.value as RobotsRuleType })}><option>Allow</option><option>Disallow</option></select></label>
                    <label className="field"><span>Path</span><input value={rule.path} onChange={(event) => updateRule(groupIndex, ruleIndex, { path: event.target.value })} placeholder="/admin/" /></label>
                  </div>
                ))}
                <div className="button-row">
                  <button className="button secondary" type="button" onClick={() => updateGroup(groupIndex, { rules: [...group.rules, { type: 'Disallow', path: '/' }] })}>Add rule</button>
                  {group.rules.length > 1 ? <button className="button secondary" type="button" onClick={() => updateGroup(groupIndex, { rules: group.rules.slice(0, -1) })}>Remove last rule</button> : null}
                </div>
                <label className="field"><span>Crawl-delay optional</span><input inputMode="decimal" value={group.crawlDelay || ''} onChange={(event) => updateGroup(groupIndex, { crawlDelay: event.target.value })} placeholder="10" /></label>
              </div>
            ))}
            <label className="field"><span>Sitemap URL optional</span><input inputMode="url" value={sitemapUrl} onChange={(event) => setSitemapUrl(event.target.value)} placeholder="https://example.com/sitemap.xml" /></label>
            <div className="button-row">
              <button className="button secondary" type="button" onClick={() => setGroups([...groups, { userAgent: '*', rules: [{ type: 'Disallow', path: '/' }] }])}>Add user-agent group</button>
              {groups.length > 1 ? <button className="button secondary" type="button" onClick={() => setGroups(groups.slice(0, -1))}>Remove last group</button> : null}
            </div>
          </>
        )}
        {dangerous ? <p className="field-error" role="alert">Warning: User-agent: * with Disallow: / can block the entire site from crawling. This is allowed if you intend it.</p> : null}
        <div className="button-row"><button className="button secondary" type="button" onClick={reset}>Reset</button></div>
      </div>
      <div className="result-card">
        <div className="panel-label"><span>robots.txt output</span></div>
        <label className="counter-editor"><span className="sr-only">robots.txt output</span><textarea readOnly spellCheck={false} value={robotsTxt} /></label>
        <div className="button-row">
          <CopyButton value={robotsTxt} label="Copy robots.txt" />
          <DownloadButton value={robotsTxt} filename="robots.txt" label="Download robots.txt" />
        </div>
      </div>
    </section>
  )
}
