import { useEffect, useRef, useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { mediaKindFromFile, previewKind } from '../../lib/media/kind'
import { useObjectUrl } from '../../lib/media/object-url'
import { VoiceRecorderWorkspace } from './VoiceRecorderWorkspace'
import { formatBytes } from './workspace-utils'

export function BrowserMediaWorkspace({ tool }: { tool: ToolDefinition }) {
  if (tool.slug === 'voice-recorder') return <VoiceRecorderWorkspace/>
  return <MediaWorkspace tool={tool}/>
}

function MediaWorkspace({ tool }: { tool: ToolDefinition }) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState<number | null>(null)
  const [rate, setRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const url = useObjectUrl(file)
  const kind = file ? previewKind(file, tool.category) : 'video'
  const video = kind === 'video'

  function select(next: File | undefined) {
    if (!next) return
    if (!next.type.startsWith('audio/') && !next.type.startsWith('video/') && mediaKindFromFile(next) == null) {
      setError('Choose an audio or video file supported by this browser.')
      return
    }
    setFile(next)
    setDuration(null)
    setError('')
  }

  useEffect(() => {
    const element = videoRef.current ?? audioRef.current
    if (element) {
      element.playbackRate = rate
      element.volume = volume
    }
  }, [rate, volume])

  function capture() {
    const element = videoRef.current
    if (!element || !element.videoWidth) {
      setError('Load a playable video frame before capturing.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = element.videoWidth
    canvas.height = element.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setError('Canvas capture is unavailable.')
      return
    }
    context.drawImage(element, 0, 0)
    const anchor = document.createElement('a')
    anchor.download = tool.slug === 'generate-thumbnail' ? 'thumbnail.png' : 'video-screenshot.png'
    anchor.href = canvas.toDataURL('image/png')
    anchor.click()
    setError('')
  }

  const captureTool = tool.slug === 'generate-thumbnail' || tool.slug === 'video-screenshot'
  const onLoadedMetadata = () => {
    setDuration((videoRef.current ?? audioRef.current)?.duration ?? null)
  }

  return (
    <section className="workspace split-workspace">
      <div className="options-panel">
        <label className="field">
          <span>Media file</span>
          <input aria-label="Media file" type="file" accept="audio/*,video/*" onChange={(event) => select(event.target.files?.[0])}/>
        </label>
        {tool.slug === 'change-audio-speed' && (
          <label className="field">
            <span>Playback speed: {rate}x</span>
            <input aria-label="Playback speed" type="range" min="0.25" max="3" step="0.25" value={rate} onChange={(event) => setRate(Number(event.target.value))}/>
          </label>
        )}
        {tool.slug === 'change-volume' && (
          <label className="field">
            <span>Preview volume: {Math.round(volume * 100)}%</span>
            <input aria-label="Preview volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))}/>
          </label>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
        {captureTool && <button className="button primary" type="button" disabled={!url} onClick={capture}>Capture frame</button>}
      </div>
      <div className="result-card">
        <div className="panel-label"><span>Preview</span></div>
        {file && url && (
          <div className="media-preview">
            <p className="media-preview-meta">{file.name} · {formatBytes(file.size)}{duration != null ? ` · ${duration.toFixed(1)}s` : ''}</p>
            {video
              ? <video ref={videoRef} src={url} controls preload="metadata" onLoadedMetadata={onLoadedMetadata} aria-label="Input preview"/>
              : <audio ref={audioRef} src={url} controls preload="metadata" onLoadedMetadata={onLoadedMetadata} aria-label="Input preview"/>}
          </div>
        )}
      </div>
    </section>
  )
}
