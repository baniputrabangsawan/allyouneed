import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import type { ToolDefinition } from '../tools/tool-registry'
import { generateOpenGraphTags, type OgType, type TwitterCard } from './open-graph'
import { CopyButton } from './workspace-ui'

const emptyForm = {
  title: '',
  description: '',
  url: '',
  siteName: '',
  imageUrl: '',
  type: 'website' as OgType,
  twitterCard: 'summary_large_image' as TwitterCard,
}

export function OpenGraphWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const [title, setTitle] = useState(emptyForm.title)
  const [description, setDescription] = useState(emptyForm.description)
  const [url, setUrl] = useState(emptyForm.url)
  const [siteName, setSiteName] = useState(emptyForm.siteName)
  const [imageUrl, setImageUrl] = useState(emptyForm.imageUrl)
  const [type, setType] = useState<OgType>(emptyForm.type)
  const [twitterCard, setTwitterCard] = useState<TwitterCard>(emptyForm.twitterCard)
  const [imageLoadError, setImageLoadError] = useState(false)

  const result = generateOpenGraphTags({ title, description, url, siteName, imageUrl, type, twitterCard })
  const previewImage = result.preview.imageUrl

  useEffect(() => {
    setImageLoadError(false)
  }, [previewImage])

  function reset() {
    setTitle(emptyForm.title)
    setDescription(emptyForm.description)
    setUrl(emptyForm.url)
    setSiteName(emptyForm.siteName)
    setImageUrl(emptyForm.imageUrl)
    setType(emptyForm.type)
    setTwitterCard(emptyForm.twitterCard)
    setImageLoadError(false)
  }

  const imageInvalid = result.imageError || imageLoadError
  const imageStatus = result.imageError
    ? copy.openGraph.invalidImageUrl
    : imageLoadError
      ? copy.openGraph.imageLoadFailed
      : null

  return (
    <section className="workspace og-workspace" aria-label={tool.name}>
      <div className="og-workspace-top">
        <div className="options-panel">
          <div className="panel-label"><span>{copy.openGraph.settings}</span></div>
          <label className="field">
            <span>{copy.openGraph.pageTitle}</span>
            <input aria-label={copy.openGraph.pageTitle} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>{copy.openGraph.description}</span>
            <textarea aria-label={copy.openGraph.description} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="field">
            <span>{copy.openGraph.url}</span>
            <input
              aria-label={copy.openGraph.url}
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              value={url}
              aria-invalid={result.urlError || undefined}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/page"
            />
          </label>
          {result.urlError ? <p className="field-error" role="alert">{copy.openGraph.invalidUrl}</p> : null}
          <label className="field">
            <span>{copy.openGraph.siteName}</span>
            <input aria-label={copy.openGraph.siteName} value={siteName} onChange={(event) => setSiteName(event.target.value)} />
          </label>
          <label className="field">
            <span>{copy.openGraph.imageUrl}</span>
            <input
              aria-label={copy.openGraph.imageUrl}
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              value={imageUrl}
              aria-invalid={imageInvalid || undefined}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://example.com/og.png"
            />
          </label>
          {imageStatus ? <p className="field-error" role="alert">{imageStatus}</p> : null}
          <div className="field-grid">
            <label className="field">
              <span>{copy.openGraph.contentType}</span>
              <select aria-label={copy.openGraph.contentType} value={type} onChange={(event) => setType(event.target.value as OgType)}>
                <option value="website">{copy.openGraph.typeWebsite}</option>
                <option value="article">{copy.openGraph.typeArticle}</option>
              </select>
            </label>
            <label className="field">
              <span>{copy.openGraph.twitterCard}</span>
              <select aria-label={copy.openGraph.twitterCard} value={twitterCard} onChange={(event) => setTwitterCard(event.target.value as TwitterCard)}>
                <option value="summary_large_image">{copy.openGraph.cardLarge}</option>
                <option value="summary">{copy.openGraph.cardSummary}</option>
              </select>
            </label>
          </div>
        </div>
        <div className="result-card og-preview-panel">
          <div className="panel-label"><span>{copy.openGraph.preview}</span></div>
          <OgCard
            title={result.preview.title}
            description={result.preview.description}
            hostname={result.preview.hostname}
            siteName={result.preview.siteName}
            imageUrl={previewImage}
            imageInvalid={imageInvalid}
            onImageError={() => setImageLoadError(true)}
            emptyTitle={copy.openGraph.untitled}
            emptyDescription={copy.openGraph.noDescription}
            label={copy.openGraph.ogPreview}
          />
          <TwitterCardPreview
            title={result.preview.title}
            description={result.preview.description}
            hostname={result.preview.hostname}
            imageUrl={previewImage}
            imageInvalid={imageInvalid}
            card={result.preview.twitterCard}
            onImageError={() => setImageLoadError(true)}
            emptyTitle={copy.openGraph.untitled}
            emptyDescription={copy.openGraph.noDescription}
            label={copy.openGraph.twitterPreview}
          />
          <p className="local-note">{copy.openGraph.previewDisclaimer}</p>
        </div>
      </div>
      <div className="result-card og-html-panel">
        <div className="panel-label"><span>{copy.openGraph.generatedHtml}</span></div>
        <label className="counter-editor">
          <span className="sr-only">{copy.openGraph.generatedHtml}</span>
          <textarea
            aria-label={copy.openGraph.generatedHtml}
            readOnly
            spellCheck={false}
            value={result.html}
            placeholder={copy.workspace.resultPlaceholder}
          />
        </label>
        <div className="button-row">
          <CopyButton value={result.html} label={copy.openGraph.copyTags} />
          <button className="button secondary" type="button" onClick={reset}>{copy.openGraph.reset}</button>
        </div>
      </div>
    </section>
  )
}

function PreviewImage({
  src,
  invalid,
  onError,
  className,
}: {
  src: string | null
  invalid: boolean
  onError: () => void
  className: string
}) {
  if (!src || invalid) {
    return <div className={`${className} og-preview-image-empty`} aria-hidden="true" />
  }
  return <img className={className} src={src} alt="" referrerPolicy="no-referrer" onError={onError} />
}

function OgCard({
  title,
  description,
  hostname,
  siteName,
  imageUrl,
  imageInvalid,
  onImageError,
  emptyTitle,
  emptyDescription,
  label,
}: {
  title: string
  description: string
  hostname: string
  siteName: string
  imageUrl: string | null
  imageInvalid: boolean
  onImageError: () => void
  emptyTitle: string
  emptyDescription: string
  label: string
}) {
  return (
    <article className="og-card" aria-label={label}>
      <p className="og-card-kicker">{label}</p>
      <div className="og-card-frame">
        <PreviewImage src={imageUrl} invalid={imageInvalid} onError={onImageError} className="og-card-image" />
        <div className="og-card-body">
          <p className="og-card-domain">{hostname || siteName || 'example.com'}</p>
          <p className={title ? 'og-card-title' : 'og-card-title is-empty'}>{title || emptyTitle}</p>
          <p className={description ? 'og-card-copy' : 'og-card-copy is-empty'}>{description || emptyDescription}</p>
        </div>
      </div>
    </article>
  )
}

function TwitterCardPreview({
  title,
  description,
  hostname,
  imageUrl,
  imageInvalid,
  card,
  onImageError,
  emptyTitle,
  emptyDescription,
  label,
}: {
  title: string
  description: string
  hostname: string
  imageUrl: string | null
  imageInvalid: boolean
  card: TwitterCard
  onImageError: () => void
  emptyTitle: string
  emptyDescription: string
  label: string
}) {
  const large = card === 'summary_large_image'
  return (
    <article className={large ? 'og-card x-card' : 'og-card x-card is-summary'} aria-label={label}>
      <p className="og-card-kicker">{label}</p>
      <div className="x-card-frame">
        {large ? <PreviewImage src={imageUrl} invalid={imageInvalid} onError={onImageError} className="og-card-image" /> : null}
        <div className="x-card-row">
          <div className="og-card-body">
            <p className={title ? 'og-card-title' : 'og-card-title is-empty'}>{title || emptyTitle}</p>
            <p className={description ? 'og-card-copy' : 'og-card-copy is-empty'}>{description || emptyDescription}</p>
            <p className="og-card-domain">{hostname || 'example.com'}</p>
          </div>
          {large ? null : <PreviewImage src={imageUrl} invalid={imageInvalid} onError={onImageError} className="x-card-thumb" />}
        </div>
      </div>
    </article>
  )
}
