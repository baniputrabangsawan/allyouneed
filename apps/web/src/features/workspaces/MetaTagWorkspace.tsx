import { useState } from 'react'
import { useT } from '@/i18n'
import type { ToolDefinition } from '../tools/tool-registry'
import {
  codePointLength,
  DESCRIPTION_RECOMMENDED,
  generateMetaTags,
  TITLE_RECOMMENDED,
  type RobotsFollow,
  type RobotsIndex,
} from './meta-tags'
import { CopyButton, DownloadButton } from './workspace-ui'

const emptyForm = {
  title: '',
  description: '',
  canonicalUrl: '',
  robotsIndex: 'index' as RobotsIndex,
  robotsFollow: 'follow' as RobotsFollow,
  author: '',
  themeColor: '',
}

export function MetaTagWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const [title, setTitle] = useState(emptyForm.title)
  const [description, setDescription] = useState(emptyForm.description)
  const [canonicalUrl, setCanonicalUrl] = useState(emptyForm.canonicalUrl)
  const [robotsIndex, setRobotsIndex] = useState<RobotsIndex>(emptyForm.robotsIndex)
  const [robotsFollow, setRobotsFollow] = useState<RobotsFollow>(emptyForm.robotsFollow)
  const [author, setAuthor] = useState(emptyForm.author)
  const [themeColor, setThemeColor] = useState(emptyForm.themeColor)

  const result = generateMetaTags({ title, description, canonicalUrl, robotsIndex, robotsFollow, author, themeColor })
  const titleCount = codePointLength(title)
  const descriptionCount = codePointLength(description)

  function reset() {
    setTitle(emptyForm.title)
    setDescription(emptyForm.description)
    setCanonicalUrl(emptyForm.canonicalUrl)
    setRobotsIndex(emptyForm.robotsIndex)
    setRobotsFollow(emptyForm.robotsFollow)
    setAuthor(emptyForm.author)
    setThemeColor(emptyForm.themeColor)
  }

  return (
    <section className="workspace split-workspace" aria-label={tool.name}>
      <div className="options-panel">
        <label className="field">
          <span>{copy.metaTag.pageTitle}</span>
          <input
            aria-label={copy.metaTag.pageTitle}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <p className="option-help" aria-live="polite">
          {copy.metaTag.titleCount(titleCount, TITLE_RECOMMENDED.min, TITLE_RECOMMENDED.max)}
        </p>
        <label className="field">
          <span>{copy.metaTag.metaDescription}</span>
          <textarea
            aria-label={copy.metaTag.metaDescription}
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <p className="option-help" aria-live="polite">
          {copy.metaTag.descriptionCount(descriptionCount, DESCRIPTION_RECOMMENDED.min, DESCRIPTION_RECOMMENDED.max)}
        </p>
        <label className="field">
          <span>{copy.metaTag.canonicalUrl}</span>
          <input
            aria-label={copy.metaTag.canonicalUrl}
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            value={canonicalUrl}
            onChange={(event) => setCanonicalUrl(event.target.value)}
            placeholder="https://example.com/page"
          />
        </label>
        {result.canonicalError ? <p className="field-error" role="alert">{copy.metaTag.invalidUrl}</p> : null}
        <div className="field-grid">
          <label className="field">
            <span>{copy.metaTag.indexing}</span>
            <select
              aria-label={copy.metaTag.indexing}
              value={robotsIndex}
              onChange={(event) => setRobotsIndex(event.target.value as RobotsIndex)}
            >
              <option value="index">{copy.metaTag.index}</option>
              <option value="noindex">{copy.metaTag.noindex}</option>
            </select>
          </label>
          <label className="field">
            <span>{copy.metaTag.linkFollowing}</span>
            <select
              aria-label={copy.metaTag.linkFollowing}
              value={robotsFollow}
              onChange={(event) => setRobotsFollow(event.target.value as RobotsFollow)}
            >
              <option value="follow">{copy.metaTag.follow}</option>
              <option value="nofollow">{copy.metaTag.nofollow}</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>{copy.metaTag.author}</span>
          <input
            aria-label={copy.metaTag.author}
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder={copy.metaTag.optional}
          />
        </label>
        <label className="field">
          <span>{copy.metaTag.themeColor}</span>
          <input
            aria-label={copy.metaTag.themeColor}
            spellCheck={false}
            value={themeColor}
            onChange={(event) => setThemeColor(event.target.value)}
            placeholder="#0F172A"
          />
        </label>
        {result.themeColorError ? <p className="field-error" role="alert">{copy.metaTag.invalidTheme}</p> : null}
        <div className="button-row">
          <button className="button secondary" type="button" onClick={reset}>{copy.metaTag.reset}</button>
        </div>
      </div>
      <div className="result-card">
        <div className="panel-label"><span>{copy.metaTag.generatedHtml}</span></div>
        <label className="counter-editor">
          <span className="sr-only">{copy.metaTag.generatedHtml}</span>
          <textarea
            aria-label={copy.metaTag.generatedHtml}
            readOnly
            spellCheck={false}
            value={result.html}
            placeholder={copy.workspace.resultPlaceholder}
          />
        </label>
        <div className="button-row">
          <CopyButton value={result.html} label={copy.metaTag.copyHtml} />
          <DownloadButton value={result.html} filename="meta-tags.html" type="text/html" />
        </div>
      </div>
    </section>
  )
}
