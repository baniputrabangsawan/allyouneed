export interface ToolGuide {
  slug: string
  overview: string
  steps: string[]
  optionDocs?: Array<{ name: string; description: string }>
  output?: string
  example?: string
  troubleshooting?: Array<{ problem: string; solution: string }>
  keywords?: string[]
}

export interface DocsArticle {
  slug: string
  title: string
  description: string
  keywords: string[]
}

export const docsCategoryCopy: Record<string, string> = {
  image: 'Compress, resize, convert, and edit photos in your browser.',
  pdf: 'Merge, split, compress, convert, and protect PDF files.',
  audio: 'Convert, trim, merge, and process audio on the server.',
  video: 'Compress, convert, and edit video with server processing.',
  qr: 'Generate QR codes for URLs, Wi-Fi, contacts, and more.',
  developer: 'Format, validate, encode, and inspect developer data.',
  text: 'Clean, compare, and transform text without an account.',
  generator: 'Create passwords, palettes, CSS, and other small assets.',
  converter: 'Move between formats for images, documents, and data.',
}
