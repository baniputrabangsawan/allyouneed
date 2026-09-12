import { useT } from '@/i18n'
import { CopyButton, DownloadButton } from './workspace-ui'
import { textDownloadName } from './json-text'

export function ExtractedText({ text, filename }: { text: string; filename: string }) {
  const copy = useT()
  const trimmed = text.trim()
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
  return (
    <div className="extracted-result">
      <div className="panel-label">
        <span>{copy.workspace.extractedText}</span>
      </div>
      <p className="extracted-counts">
        {copy.workspace.wordCount(words)} · {copy.workspace.characterCount(text.length)}
      </p>
      <div className="button-row">
        <CopyButton value={text} />
        <DownloadButton value={text} filename={textDownloadName(filename)} label={copy.workspace.downloadTxt} />
      </div>
      <pre className="extracted-text">{text}</pre>
    </div>
  )
}
