import { useState } from 'react'
import { useT } from '@/i18n'
import type { ToolDefinition } from '../tools/tool-registry'
import {
  emptyJsonLdInput,
  errorFor,
  generateJsonLd,
  SCALAR_FIELDS,
  SCHEMA_TYPES,
  usesCrumbs,
  usesFaqs,
  usesSameAs,
  type JsonLdCrumb,
  type JsonLdFaq,
  type SchemaType,
} from './json-ld'
import { CopyButton, DownloadButton } from './workspace-ui'

export function JsonLdWorkspace({ tool }: { tool: ToolDefinition }) {
  const copy = useT()
  const labels = copy.jsonLd
  const [type, setType] = useState<SchemaType>('WebSite')
  const [values, setValues] = useState<Record<string, string>>({})
  const [sameAs, setSameAs] = useState('')
  const [crumbs, setCrumbs] = useState<JsonLdCrumb[]>([{ name: '', url: '' }])
  const [faqs, setFaqs] = useState<JsonLdFaq[]>([{ question: '', answer: '' }])

  const result = generateJsonLd({ type, values, sameAs, crumbs, faqs })
  const jsonValue = result.canCopy ? result.json : ''
  const scriptValue = result.canCopy ? result.script : ''

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function reset() {
    const empty = emptyJsonLdInput(type)
    setValues(empty.values)
    setSameAs(empty.sameAs)
    setCrumbs(empty.crumbs)
    setFaqs(empty.faqs)
  }

  function message(code: 'required' | 'invalid-url' | 'invalid-email' | 'invalid-date') {
    if (code === 'required') return labels.required
    if (code === 'invalid-url') return labels.invalidUrl
    if (code === 'invalid-email') return labels.invalidEmail
    return labels.invalidDate
  }

  return (
    <section className="workspace split-workspace" aria-label={tool.name}>
      <div className="options-panel">
        <label className="field">
          <span>{labels.schemaType}</span>
          <select
            aria-label={labels.schemaType}
            value={type}
            onChange={(event) => setType(event.target.value as SchemaType)}
          >
            {SCHEMA_TYPES.map((schema) => <option key={schema} value={schema}>{schema}</option>)}
          </select>
        </label>
        {SCALAR_FIELDS[type].map((field) => {
          const error = errorFor(result.errors, field.key)
          const value = values[field.key] ?? ''
          const label = labels.fields[field.key]
          const invalid = Boolean(error)
          return (
            <div key={field.key}>
              <label className="field">
                <span>{label}{field.required ? '' : ` (${labels.optional})`}</span>
                {field.kind === 'textarea' ? (
                  <textarea
                    aria-label={label}
                    aria-invalid={invalid}
                    rows={3}
                    value={value}
                    onChange={(event) => setValue(field.key, event.target.value)}
                  />
                ) : (
                  <input
                    aria-label={label}
                    aria-invalid={invalid}
                    type={field.kind === 'url' ? 'url' : field.kind === 'email' ? 'email' : field.kind === 'date' ? 'date' : 'text'}
                    inputMode={field.kind === 'url' ? 'url' : undefined}
                    autoComplete={field.kind === 'url' ? 'url' : field.kind === 'email' ? 'email' : 'off'}
                    spellCheck={field.kind === 'text'}
                    value={value}
                    onChange={(event) => setValue(field.key, event.target.value)}
                  />
                )}
              </label>
              {error ? <p className="field-error" role="alert">{message(error.code)}</p> : null}
            </div>
          )
        })}
        {usesSameAs(type) ? (
          <>
            <label className="field">
              <span>{labels.sameAs} ({labels.optional})</span>
              <textarea
                aria-label={labels.sameAs}
                aria-invalid={Boolean(errorFor(result.errors, 'sameAs'))}
                rows={3}
                spellCheck={false}
                value={sameAs}
                onChange={(event) => setSameAs(event.target.value)}
                placeholder={labels.sameAsHelp}
              />
            </label>
            {errorFor(result.errors, 'sameAs') ? <p className="field-error" role="alert">{labels.invalidUrl}</p> : null}
          </>
        ) : null}
        {usesCrumbs(type) ? (
          <>
            {errorFor(result.errors, 'crumbs') ? <p className="field-error" role="alert">{labels.required}</p> : null}
            {crumbs.map((crumb, index) => {
              const urlError = errorFor(result.errors, `crumb:${index}:url`)
              return (
                <div key={index}>
                  <div className="field-grid">
                    <label className="field">
                      <span>{labels.crumbName}</span>
                      <input
                        aria-label={`${labels.crumbName} ${index + 1}`}
                        value={crumb.name}
                        onChange={(event) => setCrumbs(crumbs.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row))}
                      />
                    </label>
                    <label className="field">
                      <span>{labels.crumbUrl} ({labels.optional})</span>
                      <input
                        aria-label={`${labels.crumbUrl} ${index + 1}`}
                        aria-invalid={Boolean(urlError)}
                        type="url"
                        inputMode="url"
                        spellCheck={false}
                        value={crumb.url}
                        onChange={(event) => setCrumbs(crumbs.map((row, rowIndex) => rowIndex === index ? { ...row, url: event.target.value } : row))}
                      />
                    </label>
                  </div>
                  {urlError ? <p className="field-error" role="alert">{labels.invalidUrl}</p> : null}
                </div>
              )
            })}
            <div className="button-row">
              <button className="button secondary" type="button" onClick={() => setCrumbs([...crumbs, { name: '', url: '' }])}>{labels.addCrumb}</button>
              {crumbs.length > 1 ? (
                <button className="button ghost" type="button" onClick={() => setCrumbs(crumbs.slice(0, -1))}>{labels.removeCrumb}</button>
              ) : null}
            </div>
          </>
        ) : null}
        {usesFaqs(type) ? (
          <>
            {errorFor(result.errors, 'faqs') ? <p className="field-error" role="alert">{labels.required}</p> : null}
            {faqs.map((faq, index) => (
              <div key={index}>
                <label className="field">
                  <span>{labels.question}</span>
                  <input
                    aria-label={`${labels.question} ${index + 1}`}
                    value={faq.question}
                    onChange={(event) => setFaqs(faqs.map((row, rowIndex) => rowIndex === index ? { ...row, question: event.target.value } : row))}
                  />
                </label>
                <label className="field">
                  <span>{labels.answer}</span>
                  <textarea
                    aria-label={`${labels.answer} ${index + 1}`}
                    rows={3}
                    value={faq.answer}
                    onChange={(event) => setFaqs(faqs.map((row, rowIndex) => rowIndex === index ? { ...row, answer: event.target.value } : row))}
                  />
                </label>
              </div>
            ))}
            <div className="button-row">
              <button className="button secondary" type="button" onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}>{labels.addFaq}</button>
              {faqs.length > 1 ? (
                <button className="button ghost" type="button" onClick={() => setFaqs(faqs.slice(0, -1))}>{labels.removeFaq}</button>
              ) : null}
            </div>
          </>
        ) : null}
        {type === 'WebSite' ? <p className="option-help">{labels.searchUrlHelp}</p> : null}
        <div className="button-row">
          <button className="button secondary" type="button" onClick={reset}>{labels.reset}</button>
        </div>
      </div>
      <div className="result-card">
        <div className="panel-label"><span>{labels.previewJson}</span></div>
        <label className="counter-editor">
          <span className="sr-only">{labels.previewJson}</span>
          <textarea
            aria-label={labels.previewJson}
            readOnly
            spellCheck={false}
            value={result.json}
            placeholder={copy.workspace.resultPlaceholder}
          />
        </label>
        <div className="button-row">
          <CopyButton value={jsonValue} label={labels.copyJson} />
          <CopyButton value={scriptValue} label={labels.copyScript} />
          <DownloadButton value={jsonValue} filename="json-ld.json" type="application/ld+json" label={labels.downloadJson} />
        </div>
      </div>
    </section>
  )
}
