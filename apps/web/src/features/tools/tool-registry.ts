import Fuse from 'fuse.js'
import { AUDIO_ACCEPT, VIDEO_ACCEPT } from '@/lib/media/formats'

export type ToolCategory = 'image' | 'qr' | 'pdf' | 'audio' | 'video' | 'text' | 'developer' | 'generator' | 'converter'
export type ProcessingMode = 'client' | 'remote' | 'hybrid'
export type ToolGroup = 'optimize' | 'create' | 'edit' | 'convert' | 'security'
export type AccessTier = 'free' | 'pro'
export type ToolImplementation =
  | 'image-canvas'
  | 'qr-code'
  | 'text'
  | 'json'
  | 'xml'
  | 'encoding'
  | 'crypto'
  | 'date-time'
  | 'color'
  | 'random'
  | 'css'
  | 'yaml'
  | 'browser-media'
  | 'remote-api'
  | 'dependency-required'

export interface ToolDefinition {
  id: string
  slug: string
  name: string
  shortDescription: string
  description: string
  category: ToolCategory
  groups: ToolGroup[]
  tags: string[]
  aliases: string[]
  icon: string
  processingMode: ProcessingMode
  acceptedFormats?: string[]
  outputFormats?: string[]
  ai?: boolean
  seo: { title: string; description: string }
  available: boolean
  implementation: ToolImplementation
  popular?: boolean
  new?: boolean
  accessTier?: AccessTier
  requiredCapability?: string
  premium?: boolean
}

type ToolOptions = Partial<Pick<ToolDefinition,
  'acceptedFormats' | 'outputFormats' | 'ai' | 'popular' | 'new' | 'processingMode' | 'accessTier' | 'requiredCapability' | 'shortDescription' | 'description'
>> & { aliases?: string[]; tags?: string[] }

const icons: Record<ToolCategory, string> = {
  image: 'Image', qr: 'QrCode', pdf: 'FileText', audio: 'AudioLines', video: 'Video',
  text: 'TextCursorInput', developer: 'Braces', generator: 'WandSparkles', converter: 'RefreshCw',
}

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const implementedSlugs = new Set([
  'compress-image', 'resize-image', 'crop-image', 'rotate-image', 'flip-image', 'convert-to-jpg',
  'convert-from-jpg', 'image-converter', 'jpg-to-png', 'png-to-jpg', 'jpg-to-webp', 'png-to-webp',
  'webp-to-jpg', 'svg-to-png', 'photo-editor', 'watermark-image', 'remove-metadata', 'favicon-generator', 'meme-generator', 'merge-png', 'blur-face', 'basic-background-removal', 'html-to-image', 'qr-code-generator', 'url-qr-code',
  'remove-background',
  'text-qr-code', 'wifi-qr-code', 'whatsapp-qr-code', 'email-qr-code', 'phone-qr-code', 'vcard-qr-code',
  'location-qr-code', 'qr-generator', 'qris-payload-parser', 'speech-to-text', 'text-to-speech', 'change-audio-speed', 'change-volume',
  'audio-converter', 'audio-compressor', 'audio-cutter', 'audio-trimmer', 'audio-merger',
  'remove-silence', 'noise-reduction', 'extract-audio-from-video', 'voice-recorder', 'generate-thumbnail', 'video-screenshot',
  'video-metadata-viewer', 'video-compressor', 'video-converter', 'video-to-gif', 'gif-to-video',
  'video-cutter', 'video-trimmer', 'video-merger', 'resize-video', 'crop-video', 'rotate-video',
  'remove-audio', 'extract-audio', 'add-audio', 'change-video-speed', 'add-watermark', 'compress-pdf',
  'merge-pdf',
  'split-pdf', 'jpg-to-pdf', 'png-to-pdf', 'pdf-to-jpg', 'pdf-to-png', 'rotate-pdf',
  'delete-pdf-pages', 'reorder-pdf-pages', 'extract-pdf-pages', 'watermark-pdf', 'page-number-pdf',
  'protect-pdf', 'unlock-pdf', 'pdf-metadata-viewer', 'pdf-to-text', 'word-counter',
  'character-counter', 'case-converter', 'remove-duplicate-lines', 'remove-extra-spaces',
  'sort-lines', 'text-cleaner', 'text-formatter', 'lorem-ipsum-generator', 'slug-generator',
  'text-compare', 'text-diff', 'markdown-preview', 'markdown-to-html', 'html-to-markdown',
  'json-formatter', 'json-validator', 'json-minifier', 'xml-formatter', 'html-formatter', 'javascript-formatter', 'yaml-to-json', 'json-to-yaml', 'base64-encode', 'base64-decode',
  'url-encode', 'url-decode', 'jwt-decoder', 'image-to-base64', 'base64-to-image', 'hash-generator',
  'sha-256', 'sha-512', 'unix-timestamp-converter', 'hex-rgb-hsl-converter', 'password-generator',
  'pin-generator', 'random-number-generator', 'uuid-generator', 'gradient-generator',
  'css-shadow-generator', 'border-radius-generator', 'color-palette-generator', 'palette-generator',
  'color-picker',
])
const defineTool = (
  name: string,
  category: ToolCategory,
  groups: ToolGroup[],
  implementation: ToolImplementation,
  options: ToolOptions = {},
): ToolDefinition => {
  const slug = slugify(name)
  const shortDescription = options.shortDescription ?? `${name} quickly with a focused, easy-to-use tool.`
  const description = options.description ?? `${name} online with clear controls and privacy-conscious processing.`
  const processingMode = options.processingMode ?? (implementation === 'remote-api' ? 'remote' : 'client')
  const available = implementedSlugs.has(slug)
  return {
    id: slug,
    slug,
    name,
    shortDescription,
    description,
    category,
    groups,
    tags: options.tags ?? [category, ...slug.split('-')],
    aliases: options.aliases ?? [],
    icon: icons[category],
    processingMode,
    ...(options.acceptedFormats ? { acceptedFormats: options.acceptedFormats } : {}),
    ...(options.outputFormats ? { outputFormats: options.outputFormats } : {}),
    ...(options.ai !== undefined ? { ai: options.ai } : {}),
    seo: { title: `${name} Online`, description },
    available,
    implementation,
    ...(options.popular !== undefined ? { popular: options.popular } : {}),
    ...(options.new !== undefined ? { new: options.new } : {}),
    ...(options.accessTier !== undefined ? { accessTier: options.accessTier } : {}),
    ...(options.requiredCapability !== undefined ? { requiredCapability: options.requiredCapability } : {}),
    ...(options.accessTier === 'pro' ? { premium: true } : {}),
  }
}

const imageFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const pdfFormat = ['application/pdf']
const audioFormats = AUDIO_ACCEPT
const videoFormats = VIDEO_ACCEPT
const qrOutputs = ['image/png', 'image/svg+xml']
const t = defineTool

export const tools: readonly ToolDefinition[] = [
  t('Compress Image', 'image', ['optimize'], 'image-canvas', { acceptedFormats: imageFormats, processingMode: 'hybrid', aliases: ['compress photo', 'shrink image', 'kompres gambar'], popular: true }),
  t('Resize Image', 'image', ['edit'], 'image-canvas', { acceptedFormats: imageFormats, popular: true }),
  t('Crop Image', 'image', ['edit'], 'image-canvas', { acceptedFormats: imageFormats }),
  t('Rotate Image', 'image', ['edit'], 'image-canvas'),
  t('Flip Image', 'image', ['edit'], 'image-canvas'),
  t('Convert to JPG', 'image', ['convert'], 'image-canvas', { outputFormats: ['image/jpeg'] }),
  t('Convert from JPG', 'image', ['convert'], 'image-canvas', { acceptedFormats: ['image/jpeg'] }),
  t('Image Converter', 'image', ['convert'], 'image-canvas', { acceptedFormats: imageFormats, outputFormats: imageFormats, aliases: ['convert photo'], popular: true }),
  t('JPG to PNG', 'image', ['convert'], 'image-canvas', { acceptedFormats: ['image/jpeg'], outputFormats: ['image/png'] }),
  t('PNG to JPG', 'image', ['convert'], 'image-canvas', { acceptedFormats: ['image/png'], outputFormats: ['image/jpeg'] }),
  t('JPG to WebP', 'image', ['convert'], 'image-canvas'),
  t('PNG to WebP', 'image', ['convert'], 'image-canvas'),
  t('WebP to JPG', 'image', ['convert'], 'image-canvas'),
  t('AVIF Converter', 'image', ['convert'], 'dependency-required'),
  t('HEIC Converter', 'image', ['convert'], 'dependency-required'),
  t('SVG to PNG', 'image', ['convert'], 'image-canvas', { acceptedFormats: ['image/svg+xml', '.svg'], outputFormats: ['image/png'] }),
  t('TIFF Converter', 'image', ['convert'], 'dependency-required'),
  t('Photo Editor', 'image', ['edit'], 'image-canvas', { acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'], outputFormats: ['image/jpeg', 'image/png', 'image/webp'] }),
  t('Watermark Image', 'image', ['edit', 'security'], 'image-canvas'),
  t('Blur Face', 'image', ['edit'], 'remote-api', { acceptedFormats: imageFormats, processingMode: 'remote' }),
  t('Blur Area', 'image', ['edit'], 'image-canvas'),
  t('Pixelate Image', 'image', ['edit'], 'image-canvas'),
  t('Remove Background', 'image', ['edit'], 'remote-api', { acceptedFormats: imageFormats, outputFormats: ['image/png'], ai: true, accessTier: 'pro', requiredCapability: 'image.ai.background_removal', aliases: ['remove bg', 'hapus background'], shortDescription: 'Remove a photo background with server-side AI.', description: 'Upload an image, choose faster or higher-quality background removal, then download a transparent PNG at the original size.' }),
  t('Basic Background Removal', 'image', ['edit'], 'remote-api', {
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    outputFormats: ['image/png'],
    aliases: ['grabcut', 'cutout', 'basic remove background'],
    shortDescription: 'Basic GrabCut cutout with a foreground box. Not AI — hair and busy backgrounds often fail.',
    description: 'Remove a simple background with OpenCV GrabCut. Adjust the foreground box, then export a transparent PNG at the original size. This is not AI segmentation: hair, glass, and complex scenes often leave leftovers or holes.',
  }),
  t('Replace Background', 'image', ['edit'], 'image-canvas'),
  t('Background Blur', 'image', ['edit'], 'remote-api', { ai: true }),
  t('Upscale Image', 'image', ['optimize'], 'remote-api', { ai: true, accessTier: 'pro', requiredCapability: 'image.ai.upscale' }),
  t('Image Enhancement', 'image', ['optimize'], 'remote-api', { ai: true }),
  t('Meme Generator', 'image', ['create'], 'image-canvas', { acceptedFormats: imageFormats, outputFormats: ['image/png', 'image/jpeg'] }),
  t('Merge PNG', 'image', ['edit', 'create'], 'image-canvas', {
    acceptedFormats: ['image/png', '.png'],
    outputFormats: ['image/png'],
    aliases: ['combine png', 'stack png', 'gabung png', 'png stitch'],
    shortDescription: 'Combine PNG images into one file in your browser.',
    description: 'Merge PNG images vertically, horizontally, or in a grid. Reorder files, set gap, padding, alignment, and background, then download one PNG. Processing stays in this browser.',
  }),
  t('HTML to Image', 'image', ['convert'], 'remote-api', { acceptedFormats: ['text/html'], outputFormats: ['image/png', 'image/jpeg'] }),
  t('Website Screenshot', 'image', ['create'], 'remote-api'),
  t('Image to Base64', 'image', ['convert'], 'encoding'),
  t('Base64 to Image', 'image', ['convert'], 'encoding'),
  t('Image Metadata Viewer', 'image', ['edit'], 'dependency-required'),
  t('Remove Metadata', 'image', ['security'], 'image-canvas'),
  t('Color Picker', 'image', ['create'], 'color'),
  t('Palette Generator', 'image', ['create'], 'color'),
  t('Favicon Generator', 'image', ['create'], 'image-canvas', { acceptedFormats: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'], outputFormats: ['image/png', 'image/x-icon', 'application/zip'] }),
  t('Profile Picture Maker', 'image', ['create'], 'image-canvas'),
  t('Passport Photo Maker', 'image', ['create'], 'image-canvas'),
  t('Thumbnail Generator', 'image', ['create'], 'image-canvas'),
  t('Social Media Image Resizer', 'image', ['edit'], 'image-canvas'),

  t('QR Code Generator', 'qr', ['create'], 'qr-code', { outputFormats: qrOutputs, aliases: ['make qr'], popular: true }),
  t('URL QR Code', 'qr', ['create'], 'qr-code', { outputFormats: qrOutputs }),
  t('Text QR Code', 'qr', ['create'], 'qr-code', { outputFormats: qrOutputs }),
  t('WiFi QR Code', 'qr', ['create'], 'qr-code', { outputFormats: qrOutputs }),
  t('WhatsApp QR Code', 'qr', ['create'], 'qr-code', { outputFormats: qrOutputs }),
  t('Email QR Code', 'qr', ['create'], 'qr-code', { outputFormats: qrOutputs }),
  t('Phone QR Code', 'qr', ['create'], 'qr-code', { outputFormats: qrOutputs }),
  t('vCard QR Code', 'qr', ['create'], 'qr-code', { outputFormats: qrOutputs }),
  t('Location QR Code', 'qr', ['create'], 'qr-code', { outputFormats: qrOutputs }),
  t('QR Code Reader', 'qr', ['convert'], 'dependency-required'),
  t('QRIS Reader', 'qr', ['convert'], 'dependency-required'),
  t('QRIS Payload Parser', 'qr', ['convert'], 'text'),
  t('Barcode Generator', 'qr', ['create'], 'dependency-required'),
  t('Barcode Reader', 'qr', ['convert'], 'dependency-required'),

  t('Text to Speech', 'audio', ['convert'], 'remote-api', {
    ai: true,
    accessTier: 'pro',
    requiredCapability: 'audio.tts.premium',
    outputFormats: ['audio/mpeg', 'audio/wav'],
    shortDescription: 'Turn text into speech on the Kits server.',
    description: 'Convert text into spoken audio on the Kits server. Content is processed on Kits, not third-party AI APIs.',
  }),
  t('Speech to Text', 'audio', ['convert'], 'remote-api', {
    ai: true,
    accessTier: 'pro',
    requiredCapability: 'audio.speech_to_text',
    acceptedFormats: [...audioFormats, ...videoFormats],
    outputFormats: ['text/plain', 'application/x-subrip', 'text/vtt'],
    shortDescription: 'Transcribe audio and video on the Kits server.',
    description: 'Transcribe speech from audio or video on the Kits server. Content is processed on Kits, not third-party AI APIs.',
  }),
  t('Audio Converter', 'audio', ['convert'], 'remote-api', { acceptedFormats: [...audioFormats, ...videoFormats] }),
  t('Audio Compressor', 'audio', ['optimize'], 'remote-api', { acceptedFormats: audioFormats }),
  t('Audio Cutter', 'audio', ['edit'], 'remote-api', { acceptedFormats: audioFormats }),
  t('Audio Trimmer', 'audio', ['edit'], 'remote-api', { acceptedFormats: audioFormats }),
  t('Audio Merger', 'audio', ['edit'], 'remote-api', { acceptedFormats: audioFormats }),
  t('Change Audio Speed', 'audio', ['edit'], 'remote-api', { acceptedFormats: audioFormats }),
  t('Change Volume', 'audio', ['edit'], 'remote-api', { acceptedFormats: audioFormats }),
  t('Remove Silence', 'audio', ['edit'], 'remote-api', { acceptedFormats: audioFormats }),
  t('Noise Reduction', 'audio', ['optimize'], 'remote-api', {
    acceptedFormats: audioFormats,
    shortDescription: 'Reduce broadband hiss and background noise from audio using FFmpeg.',
    description: 'Reduce broadband hiss and background noise from audio using FFmpeg. This reduces broadband noise; it is not vocal isolation.',
  }),
  t('Extract Audio From Video', 'audio', ['convert'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Voice Recorder', 'audio', ['create'], 'browser-media'),

  t('Compress PDF', 'pdf', ['optimize'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('Merge PDF', 'pdf', ['edit'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('Split PDF', 'pdf', ['edit'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('JPG to PDF', 'pdf', ['convert'], 'remote-api', { acceptedFormats: ['image/jpeg'] }),
  t('PNG to PDF', 'pdf', ['convert'], 'remote-api', { acceptedFormats: ['image/png'] }),
  t('PDF to JPG', 'pdf', ['convert'], 'remote-api', { acceptedFormats: pdfFormat, outputFormats: ['image/jpeg'] }),
  t('PDF to PNG', 'pdf', ['convert'], 'remote-api', { acceptedFormats: pdfFormat, outputFormats: ['image/png'] }),
  t('Rotate PDF', 'pdf', ['edit'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('Delete PDF Pages', 'pdf', ['edit'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('Reorder PDF Pages', 'pdf', ['edit'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('Extract PDF Pages', 'pdf', ['edit'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('Watermark PDF', 'pdf', ['edit', 'security'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('Page Number PDF', 'pdf', ['edit'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('Protect PDF', 'pdf', ['security'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('Unlock PDF', 'pdf', ['security'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('PDF Metadata Viewer', 'pdf', ['edit'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('PDF to Text', 'pdf', ['convert'], 'remote-api', { acceptedFormats: pdfFormat }),
  t('OCR PDF', 'pdf', ['convert'], 'remote-api', { ai: true }),
  t('HTML to PDF', 'pdf', ['convert'], 'dependency-required'),

  t('Video Compressor', 'video', ['optimize'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Video Converter', 'video', ['convert'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Video to GIF', 'video', ['convert'], 'remote-api', { acceptedFormats: videoFormats }),
  t('GIF to Video', 'video', ['convert'], 'remote-api', { acceptedFormats: ['image/gif'] }),
  t('Video Cutter', 'video', ['edit'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Video Trimmer', 'video', ['edit'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Video Merger', 'video', ['edit'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Resize Video', 'video', ['edit'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Crop Video', 'video', ['edit'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Rotate Video', 'video', ['edit'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Remove Audio', 'video', ['edit'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Extract Audio', 'video', ['convert'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Add Audio', 'video', ['edit'], 'remote-api', { acceptedFormats: [...videoFormats, ...audioFormats] }),
  t('Change Video Speed', 'video', ['edit'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Generate Thumbnail', 'video', ['create'], 'browser-media'),
  t('Add Watermark', 'video', ['edit'], 'remote-api', { acceptedFormats: videoFormats }),
  t('Add Subtitle', 'video', ['edit'], 'remote-api', { acceptedFormats: [...videoFormats, '.srt', '.vtt', '.ass', '.ssa', 'text/plain', 'text/vtt', 'application/x-subrip'] }),
  t('Video Screenshot', 'video', ['create'], 'browser-media'),
  t('Video Metadata Viewer', 'video', ['edit'], 'browser-media'),

  t('Word Counter', 'text', ['edit'], 'text', { aliases: ['character counter'], popular: true }),
  t('Character Counter', 'text', ['edit'], 'text'),
  t('Case Converter', 'text', ['convert'], 'text'),
  t('Remove Duplicate Lines', 'text', ['edit'], 'text'),
  t('Remove Extra Spaces', 'text', ['edit'], 'text'),
  t('Sort Lines', 'text', ['edit'], 'text'),
  t('Text Cleaner', 'text', ['edit'], 'text'),
  t('Text Formatter', 'text', ['edit'], 'text'),
  t('Lorem Ipsum Generator', 'text', ['create'], 'text'),
  t('Slug Generator', 'text', ['create'], 'text'),
  t('Text Compare', 'text', ['edit'], 'text'),
  t('Text Diff', 'text', ['edit'], 'text'),
  t('Markdown Preview', 'text', ['edit'], 'text'),
  t('Markdown to HTML', 'text', ['convert'], 'text'),
  t('HTML to Markdown', 'text', ['convert'], 'text'),
  t('Text to Image', 'text', ['convert'], 'image-canvas'),

  t('JSON Formatter', 'developer', ['edit'], 'json', { aliases: ['beautify json'], popular: true }),
  t('JSON Validator', 'developer', ['edit'], 'json'),
  t('JSON Minifier', 'developer', ['optimize'], 'json'),
  t('XML Formatter', 'developer', ['edit'], 'xml'),
  t('XML to JSON', 'developer', ['convert'], 'text'),
  t('YAML to JSON', 'developer', ['convert'], 'yaml'),
  t('JSON to YAML', 'developer', ['convert'], 'yaml'),
  t('HTML Formatter', 'developer', ['edit'], 'text'),
  t('CSS Formatter', 'developer', ['edit'], 'text'),
  t('JavaScript Formatter', 'developer', ['edit'], 'text'),
  t('Base64 Encode', 'developer', ['convert'], 'encoding', { aliases: ['base64 encoder'] }),
  t('Base64 Decode', 'developer', ['convert'], 'encoding', { aliases: ['base64 decoder'] }),
  t('URL Encode', 'developer', ['convert'], 'encoding'),
  t('URL Decode', 'developer', ['convert'], 'encoding'),
  t('JWT Decoder', 'developer', ['convert'], 'encoding'),
  t('Hash Generator', 'developer', ['create', 'security'], 'crypto'),
  t('SHA-256', 'developer', ['create', 'security'], 'crypto'),
  t('SHA-512', 'developer', ['create', 'security'], 'crypto'),
  t('Regex Tester', 'developer', ['edit'], 'text'),
  t('Cron Expression Generator', 'developer', ['create'], 'text'),
  t('Unix Timestamp Converter', 'developer', ['convert'], 'date-time'),
  t('HEX RGB HSL Converter', 'developer', ['convert'], 'color'),

  t('Password Generator', 'generator', ['create', 'security'], 'random', { popular: true }),
  t('PIN Generator', 'generator', ['create', 'security'], 'random'),
  t('Random Number Generator', 'generator', ['create'], 'random'),
  t('UUID Generator', 'generator', ['create'], 'random', { aliases: ['guid generator'] }),
  t('QR Generator', 'generator', ['create'], 'qr-code', { outputFormats: qrOutputs }),
  t('Gradient Generator', 'generator', ['create'], 'css'),
  t('CSS Shadow Generator', 'generator', ['create'], 'css'),
  t('Border Radius Generator', 'generator', ['create'], 'css'),
  t('Color Palette Generator', 'generator', ['create'], 'color'),
  t('Placeholder Image Generator', 'generator', ['create'], 'image-canvas'),
  t('Avatar Generator', 'generator', ['create'], 'image-canvas'),
  t('Signature Generator', 'generator', ['create'], 'image-canvas'),
  t('Invoice Generator', 'generator', ['create'], 'text'),
  t('Receipt Generator', 'generator', ['create'], 'text'),
  t('Certificate Generator', 'generator', ['create'], 'text'),
]

const fuse = new Fuse(tools, {
  keys: ['name', 'shortDescription', 'description', 'tags', 'aliases', 'category'],
  threshold: 0.32,
})
const toolsBySlug = new Map(tools.map((tool) => [tool.slug, tool]))

export const getAllTools = () => [...tools]
export const getToolBySlug = (slug: string) => toolsBySlug.get(slug)
export const getToolsByCategory = (category: ToolCategory) => tools.filter((item) => category === 'converter' ? item.groups.includes('convert') : item.category === category)
export const getToolsByGroup = (group: ToolGroup) => tools.filter((item) => item.groups.includes(group))
export const getPopularTools = () => tools.filter((item) => item.popular && item.available)
export const getNewTools = () => tools.filter((item) => item.new && item.available)
export const getProTools = () => tools.filter((tool) => tool.accessTier === 'pro' || tool.premium)
export const searchTools = (query: string) => query.trim() ? fuse.search(query).map(({ item }) => item) : getAllTools()
export const getRelatedTools = (current: ToolDefinition) => tools
  .filter((item) => item.available && item.id !== current.id && (item.category === current.category || item.groups.some((group) => current.groups.includes(group))))
  .slice(0, 4)
