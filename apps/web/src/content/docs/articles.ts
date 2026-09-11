import type { DocsArticle } from './types'

export const gettingStartedArticle: DocsArticle = {
  slug: 'getting-started',
  title: 'Getting started',
  description: 'Find a tool, add input, process, and save the result.',
  keywords: ['getting started', 'workflow', 'search', 'favorites', 'recent', 'free', 'pro'],
}

export const troubleshootingArticle: DocsArticle = {
  slug: 'troubleshooting',
  title: 'Troubleshooting',
  description: 'Fix common file, permission, license, and processing problems.',
  keywords: ['error', 'unsupported', 'too large', 'permission', 'download', 'license', 'coming soon'],
}

export const privacyArticle: DocsArticle = {
  slug: 'privacy-and-processing',
  title: 'Privacy and processing',
  description: 'Where Kits processes files: in the browser, on the server, or with a model.',
  keywords: ['privacy', 'client-side', 'server', 'upload', 'AI', 'local'],
}

export const docsArticles = [gettingStartedArticle, troubleshootingArticle, privacyArticle] as const
