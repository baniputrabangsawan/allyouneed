import { useState } from 'react'
import { useT } from '../../i18n'
import {
  AUDIO_BITRATES,
  formatPageList,
  parsePageList,
  ROTATIONS,
  SPEED_PRESETS,
  VIDEO_CRFS,
  VOLUME_PRESETS,
} from './remote-tool-options'

interface RemoteToolFieldsProps {
  toolId: string
  options: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
}

const PAGE_TOOLS: Record<string, true> = {
  'split-pdf': true,
  'delete-pdf-pages': true,
  'extract-pdf-pages': true,
  'reorder-pdf-pages': true,
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function PagesField({
  value,
  onChange,
  label,
  hint,
}: {
  value: unknown
  onChange: (pages: number[]) => void
  label: string
  hint: string
}) {
  const [text, setText] = useState(() => formatPageList(value))
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          onChange(parsePageList(event.target.value))
        }}
      />
      <small>{hint}</small>
    </label>
  )
}

export function RemoteToolFields({ toolId, options, onChange }: RemoteToolFieldsProps) {
  const copy = useT()

  if (PAGE_TOOLS[toolId]) {
    return (
      <PagesField
        value={options.pages}
        onChange={(pages) => onChange({ pages })}
        label={copy.workspace.pages}
        hint={copy.workspace.pagesHint}
      />
    )
  }

  if (toolId === 'protect-pdf' || toolId === 'unlock-pdf') {
    return (
      <label className="field">
        <span>{copy.workspace.password}</span>
        <input
          aria-label={copy.workspace.password}
          type="password"
          autoComplete="off"
          value={stringValue(options.password, '')}
          onChange={(event) => onChange({ password: event.target.value })}
        />
      </label>
    )
  }

  if (toolId === 'watermark-pdf' || toolId === 'add-watermark') {
    return (
      <label className="field">
        <span>{copy.workspace.watermarkText}</span>
        <input
          aria-label={copy.workspace.watermarkText}
          value={stringValue(options.text, 'Watermark')}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </label>
    )
  }

  if (toolId === 'rotate-pdf') {
    return (
      <label className="field">
        <span>{copy.workspace.rotation}</span>
        <select
          aria-label={copy.workspace.rotation}
          value={numberValue(options.rotation, 90)}
          onChange={(event) => onChange({ rotation: Number(event.target.value) })}
        >
          {ROTATIONS.map((degrees) => (
            <option key={degrees} value={degrees}>{degrees}°</option>
          ))}
        </select>
      </label>
    )
  }

  if (toolId === 'resize-video' || toolId === 'crop-video') {
    return (
      <div className="field-grid">
        <label className="field">
          <span>{copy.workspace.width}</span>
          <input
            aria-label={copy.workspace.width}
            type="number"
            min={2}
            value={numberValue(options.width, 640)}
            onChange={(event) => onChange({ width: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>{copy.workspace.height}</span>
          <input
            aria-label={copy.workspace.height}
            type="number"
            min={2}
            value={numberValue(options.height, 360)}
            onChange={(event) => onChange({ height: Number(event.target.value) })}
          />
        </label>
      </div>
    )
  }

  if (toolId === 'change-audio-speed' || toolId === 'change-video-speed') {
    return (
      <label className="field">
        <span>{copy.workspace.playbackSpeed}</span>
        <select
          aria-label={copy.workspace.playbackSpeed}
          value={numberValue(options.speed, 1)}
          onChange={(event) => onChange({ speed: Number(event.target.value) })}
        >
          {SPEED_PRESETS.map((speed) => (
            <option key={speed} value={speed}>{speed}x</option>
          ))}
        </select>
      </label>
    )
  }

  if (toolId === 'change-volume') {
    return (
      <label className="field">
        <span>{copy.workspace.volume}</span>
        <select
          aria-label={copy.workspace.volume}
          value={numberValue(options.volume, 1)}
          onChange={(event) => onChange({ volume: Number(event.target.value) })}
        >
          {VOLUME_PRESETS.map((volume) => (
            <option key={volume} value={volume}>{Math.round(volume * 100)}%</option>
          ))}
        </select>
      </label>
    )
  }

  if (toolId === 'noise-reduction') {
    const mode = stringValue(options.mode, 'smart')
    const strength = stringValue(options.strength, 'medium')
    return (
      <>
        <label className="field">
          <span>{copy.workspace.noiseMode}</span>
        </label>
        <div className="segmented segmented-2" role="group" aria-label={copy.workspace.noiseMode}>
          {(['standard', 'smart'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={mode === value ? 'active' : ''}
              aria-pressed={mode === value}
              onClick={() => onChange({ mode: value })}
            >
              {value === 'standard' ? copy.workspace.noiseModeStandard : copy.workspace.noiseModeSmart}
            </button>
          ))}
        </div>
        <p className="option-help" role="note">
          {mode === 'smart' ? copy.workspace.noiseModeSmartHelp : copy.workspace.noiseModeStandardHelp}
        </p>
        <label className="field">
          <span>{copy.workspace.noiseStrength}</span>
        </label>
        <div className="segmented" role="group" aria-label={copy.workspace.noiseStrength}>
          {(['light', 'medium', 'strong'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={strength === value ? 'active' : ''}
              aria-pressed={strength === value}
              onClick={() => onChange({ strength: value })}
            >
              {value === 'light' ? copy.workspace.strengthLight : value === 'medium' ? copy.workspace.strengthMedium : copy.workspace.strengthStrong}
            </button>
          ))}
        </div>
      </>
    )
  }

  if (toolId === 'blur-face') {
    const mode = stringValue(options.mode, 'blur') === 'pixelate' ? 'pixelate' : 'blur'
    return (
      <>
        <p className="option-help" role="note">{copy.workspace.blurNote}</p>
        <label className="field">
          <span>{copy.workspace.blurMode}</span>
          <select
            aria-label={copy.workspace.blurMode}
            value={mode}
            onChange={(event) => onChange({ mode: event.target.value })}
          >
            <option value="blur">{copy.workspace.blurOption}</option>
            <option value="pixelate">{copy.workspace.pixelateOption}</option>
          </select>
          <small>{copy.workspace.blurHelp}</small>
          <small>{copy.workspace.pixelateHelp}</small>
        </label>
      </>
    )
  }

  if (toolId === 'add-subtitle') {
    return (
      <>
        <p className="option-help" role="note">{copy.workspace.subtitleHelp}</p>
        <label className="field">
          <span>{copy.workspace.subtitleMode}</span>
          <select
            aria-label={copy.workspace.subtitleMode}
            value={stringValue(options.mode, 'burn')}
            onChange={(event) => onChange({ mode: event.target.value })}
          >
            <option value="burn">{copy.workspace.burnIn}</option>
            <option value="mux">{copy.workspace.mux}</option>
          </select>
        </label>
        <label className="field">
          <span>{copy.workspace.outputFormat}</span>
          <select
            aria-label={copy.workspace.outputFormat}
            value={stringValue(options.format, 'mp4')}
            onChange={(event) => onChange({ format: event.target.value })}
          >
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
          </select>
        </label>
        {stringValue(options.mode, 'burn') === 'burn' && (
          <>
            <label className="field">
              <span>{copy.workspace.fontSize}</span>
              <input
                aria-label={copy.workspace.fontSize}
                type="number"
                min={8}
                max={96}
                value={numberValue(options.fontSize, 24)}
                onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>{copy.workspace.textColor}</span>
              <input
                aria-label={copy.workspace.textColor}
                type="color"
                value={stringValue(options.fontColor, '#ffffff')}
                onChange={(event) => onChange({ fontColor: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{copy.workspace.subtitleOutline}</span>
              <select
                aria-label={copy.workspace.subtitleOutline}
                value={stringValue(options.outline, 'outline')}
                onChange={(event) => onChange({ outline: event.target.value })}
              >
                <option value="none">{copy.workspace.outlineNone}</option>
                <option value="outline">{copy.workspace.outlineStroke}</option>
                <option value="background">{copy.workspace.outlineBackground}</option>
              </select>
            </label>
            <label className="field">
              <span>{copy.workspace.subtitlePosition}</span>
              <select
                aria-label={copy.workspace.subtitlePosition}
                value={stringValue(options.position, 'bottom')}
                onChange={(event) => onChange({ position: event.target.value })}
              >
                <option value="bottom">{copy.workspace.positionBottom}</option>
                <option value="middle">{copy.workspace.positionMiddle}</option>
                <option value="top">{copy.workspace.positionTop}</option>
              </select>
            </label>
            <label className="field">
              <span>{copy.workspace.bottomMargin}</span>
              <input
                aria-label={copy.workspace.bottomMargin}
                type="number"
                min={0}
                max={200}
                value={numberValue(options.marginV, 24)}
                onChange={(event) => onChange({ marginV: Number(event.target.value) })}
              />
            </label>
          </>
        )}
      </>
    )
  }

  if (toolId === 'audio-cutter' || toolId === 'audio-trimmer' || toolId === 'video-cutter' || toolId === 'video-trimmer') {
    return (
      <div className="field-grid">
        <label className="field">
          <span>{copy.workspace.startSeconds}</span>
          <input
            aria-label={copy.workspace.startSeconds}
            type="number"
            min={0}
            step={0.1}
            value={numberValue(options.start, 0)}
            onChange={(event) => onChange({ start: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>{copy.workspace.durationSeconds}</span>
          <input
            aria-label={copy.workspace.durationSeconds}
            type="number"
            min={0.1}
            step={0.1}
            value={numberValue(options.duration, 10)}
            onChange={(event) => onChange({ duration: Number(event.target.value) })}
          />
        </label>
      </div>
    )
  }

  if (toolId === 'audio-compressor') {
    return (
      <label className="field">
        <span>{copy.workspace.bitrate}</span>
        <select
          aria-label={copy.workspace.bitrate}
          value={stringValue(options.bitrate, '128k')}
          onChange={(event) => onChange({ bitrate: event.target.value })}
        >
          {AUDIO_BITRATES.map((bitrate) => (
            <option key={bitrate} value={bitrate}>{bitrate}</option>
          ))}
        </select>
      </label>
    )
  }

  if (toolId === 'video-compressor') {
    return (
      <label className="field">
        <span>{copy.workspace.quality}</span>
        <select
          aria-label={copy.workspace.quality}
          value={numberValue(options.crf, 28)}
          onChange={(event) => onChange({ crf: Number(event.target.value) })}
        >
          {VIDEO_CRFS.map((crf) => (
            <option key={crf} value={crf}>CRF {crf}</option>
          ))}
        </select>
      </label>
    )
  }

  return null
}
