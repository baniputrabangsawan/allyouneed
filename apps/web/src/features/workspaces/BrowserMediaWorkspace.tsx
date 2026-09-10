import { useEffect, useRef, useState } from 'react'
import type { ToolDefinition } from '../tools/tool-registry'
import { formatBytes } from './workspace-utils'

export function BrowserMediaWorkspace({ tool }: { tool: ToolDefinition }) {
  if (tool.slug === 'text-to-speech') return <SpeechWorkspace/>
  if (tool.slug === 'voice-recorder') return <RecorderWorkspace/>
  return <MediaWorkspace tool={tool}/>
}

function SpeechWorkspace() {
  const [text, setText] = useState(''), [error, setError] = useState('')
  function speak() {
    if (!('speechSynthesis' in window)) { setError('Text-to-speech is not available in this browser.'); return }
    if (!text.trim()) { setError('Enter text to speak.'); return }
    speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); setError('')
  }
  useEffect(() => () => { if ('speechSynthesis' in window) speechSynthesis.cancel() }, [])
  return <section className="workspace"><label className="counter-editor"><span>Text to speak</span><textarea aria-label="Text to speak" value={text} onChange={(event) => setText(event.target.value)}/></label>{error && <p className="field-error" role="alert">{error}</p>}<div className="button-row"><button className="button primary" type="button" onClick={speak}>Speak</button><button className="button secondary" type="button" onClick={() => speechSynthesis.cancel()}>Stop</button></div></section>
}

function RecorderWorkspace() {
  const [error, setError] = useState('')
  async function check() {
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) { setError('Audio recording is not supported in this browser or insecure context.'); return }
    setError('Recording requires a permission and session workflow that this basic workspace does not provide. No microphone data was captured.')
  }
  return <section className="workspace compact-workspace"><div className="result-card"><p>This browser may support microphone recording, but capability and permission vary by browser and context.</p>{error && <p className="field-error" role="status">{error}</p>}<button className="button primary" type="button" onClick={() => void check()}>Check recording capability</button></div></section>
}

function MediaWorkspace({ tool }: { tool: ToolDefinition }) {
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState(''), [error, setError] = useState(''), [duration, setDuration] = useState<number | null>(null)
  const [rate, setRate] = useState(1), [volume, setVolume] = useState(1)
  const media = useRef<HTMLMediaElement>(null)
  const video = file?.type.startsWith('video/') ?? (tool.slug.includes('video') || tool.slug.includes('thumbnail') || tool.slug.includes('screenshot'))
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  function select(next: File | undefined) {
    if (!next) return
    if (!next.type.startsWith('audio/') && !next.type.startsWith('video/')) { setError('Choose an audio or video file supported by this browser.'); return }
    if (url) URL.revokeObjectURL(url)
    setFile(next); setUrl(URL.createObjectURL(next)); setDuration(null); setError('')
  }
  useEffect(() => { if (media.current) { media.current.playbackRate = rate; media.current.volume = volume } }, [rate, volume])
  function capture() {
    const element = media.current
    if (!(element instanceof HTMLVideoElement) || !element.videoWidth) { setError('Load a playable video frame before capturing.'); return }
    const canvas = document.createElement('canvas'); canvas.width = element.videoWidth; canvas.height = element.videoHeight
    const context = canvas.getContext('2d'); if (!context) { setError('Canvas capture is unavailable.'); return }
    context.drawImage(element, 0, 0); const anchor = document.createElement('a'); anchor.download = tool.slug === 'generate-thumbnail' ? 'thumbnail.png' : 'video-screenshot.png'; anchor.href = canvas.toDataURL('image/png'); anchor.click(); setError('')
  }
  const captureTool = tool.slug === 'generate-thumbnail' || tool.slug === 'video-screenshot'
  return <section className="workspace split-workspace"><div className="options-panel"><label className="field"><span>Media file</span><input aria-label="Media file" type="file" accept="audio/*,video/*" onChange={(event) => select(event.target.files?.[0])}/></label>{tool.slug === 'change-audio-speed' && <label className="field"><span>Playback speed: {rate}x</span><input aria-label="Playback speed" type="range" min="0.25" max="3" step="0.25" value={rate} onChange={(event) => setRate(Number(event.target.value))}/></label>}{tool.slug === 'change-volume' && <label className="field"><span>Preview volume: {Math.round(volume * 100)}%</span><input aria-label="Preview volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))}/></label>}<p className="option-help">Playback controls preview changes only. This workspace does not claim to export re-encoded media.</p></div><div className="result-card">{url && (video ? <video ref={media as React.RefObject<HTMLVideoElement>} src={url} controls onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}>Your browser cannot preview this video.</video> : <audio ref={media as React.RefObject<HTMLAudioElement>} src={url} controls onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}>Your browser cannot preview this audio.</audio>)}{file && <dl><dt>Name</dt><dd>{file.name}</dd><dt>Type</dt><dd>{file.type || 'Unknown'}</dd><dt>Size</dt><dd>{formatBytes(file.size)}</dd><dt>Duration</dt><dd>{duration === null || !Number.isFinite(duration) ? 'Unavailable' : `${duration.toFixed(2)} seconds`}</dd><dt>Last modified</dt><dd>{new Date(file.lastModified).toLocaleString()}</dd></dl>}{captureTool && <button className="button primary" type="button" disabled={!url} onClick={capture}>Download current frame</button>}{error && <p className="field-error" role="alert">{error}</p>}</div></section>
}
