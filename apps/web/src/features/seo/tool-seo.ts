import { getRelatedTools, getToolBySlug, type ToolDefinition } from '@/features/tools/tool-registry'
import type { Locale } from '@/i18n/config'
import { localizeTool } from '@/i18n/tools'
import { absoluteUrl, seoImage, SITE_NAME, SITE_URL } from './site'

type ToolSeoCopy = {
  title: string
  description: string
  h1: string
  intro: string
  steps: string[]
  benefits: string[]
  faq: { question: string; answer: string }[]
}

const priorityCopy: Record<string, Partial<Record<Locale, Partial<ToolSeoCopy>>>> = {
  'compress-image': {
    en: {
      title: 'Compress Image Online Free | Kits',
      description: 'Compress JPG, PNG and WebP images online with Kits. Reduce image file size quickly while preserving visual quality.',
      h1: 'Compress Image Online',
      intro: 'Compress JPG, PNG and WebP images online to reduce file size while maintaining good visual quality. Kits lets you optimize images directly from your browser with no complicated setup.',
      benefits: ['Make website images load faster.', 'Reduce upload size for forms and messages.', 'Save storage while keeping a useful preview quality.'],
    },
    id: {
      title: 'Kompres Gambar Online | Kits',
      description: 'Kompres gambar JPG, PNG, dan WebP online dengan Kits. Perkecil ukuran foto secara cepat dan mudah.',
      h1: 'Kompres Gambar Online',
      intro: 'Kompres foto dan gambar JPG, PNG, atau WebP untuk memperkecil ukuran file tanpa pengaturan rumit. Kits membantu optimasi gambar langsung dari browser.',
      benefits: ['Perkecil ukuran foto untuk diunggah.', 'Buat gambar lebih ringan untuk website.', 'Bagikan file lebih mudah tanpa aplikasi tambahan.'],
    },
  },
  'remove-background': {
    en: {
      title: 'Remove Background from Image Online | Kits',
      description: 'Remove image backgrounds automatically with Kits. Create transparent PNG images with AI-powered background removal.',
      h1: 'Remove Background from Image Online',
      intro: 'Remove a photo background and create a transparent PNG using Kits. This Pro tool uses server-side AI processing for clean background removal.',
      benefits: ['Create product cutouts and profile images.', 'Export a transparent PNG result.', 'Use AI processing for detailed subjects.'],
    },
    id: {
      title: 'Hapus Background Foto Online | Kits',
      description: 'Hapus background foto online dengan Kits. Buat gambar PNG transparan memakai penghapus background berbasis AI.',
      h1: 'Hapus Background Foto Online',
      intro: 'Hapus background foto, buat latar belakang transparan, dan unduh hasil PNG dengan Kits. Tool Pro ini memakai pemrosesan AI di server.',
      benefits: ['Buat foto produk dengan background transparan.', 'Cocok untuk profil, katalog, dan konten sosial.', 'Gunakan background remover online tanpa mengedit manual.'],
    },
  },
  'resize-image': {
    en: { title: 'Resize Image Online Free | Kits', description: 'Resize JPG, PNG and WebP images online with Kits. Set image width and height, preview the result and download quickly.', h1: 'Resize Image Online' },
    id: { title: 'Ubah Ukuran Gambar Online | Kits', description: 'Ubah ukuran foto dan gambar JPG, PNG, atau WebP online. Atur lebar dan tinggi lalu unduh hasilnya.', h1: 'Ubah Ukuran Gambar Online' },
  },
  'image-converter': {
    en: { title: 'Image Converter Online Free | Kits', description: 'Convert images online with Kits. Change JPG, PNG, WebP and AVIF files into the format you need quickly.', h1: 'Image Converter Online' },
    id: { title: 'Konversi Gambar Online | Kits', description: 'Convert gambar online dengan Kits. Ubah format JPG, PNG, WebP, dan AVIF dengan cepat dari browser.', h1: 'Konversi Gambar Online' },
  },
  'png-to-jpg': {
    en: { title: 'PNG to JPG Converter Online Free | Kits', description: 'Convert PNG images to JPG online quickly with Kits. Adjust image quality and download your converted JPG instantly.', h1: 'PNG to JPG Converter' },
    id: { title: 'PNG ke JPG Online | Kits', description: 'Convert PNG ke JPG online dengan Kits. Ubah gambar PNG menjadi JPG dan unduh hasilnya dengan cepat.', h1: 'PNG ke JPG Online' },
  },
  'jpg-to-png': {
    en: { title: 'JPG to PNG Converter Online Free | Kits', description: 'Convert JPG images to PNG online with Kits. Create PNG files from JPEG photos quickly in your browser.', h1: 'JPG to PNG Converter' },
    id: { title: 'JPG ke PNG Online | Kits', description: 'Convert JPG ke PNG online dengan Kits. Ubah foto JPEG menjadi file PNG langsung dari browser.', h1: 'JPG ke PNG Online' },
  },
  'pdf-to-png': {
    en: { title: 'PDF to PNG Converter Online | Kits', description: 'Convert PDF pages to PNG images online with Kits. Upload a PDF and download clear PNG page images.', h1: 'PDF to PNG Converter' },
    id: { title: 'PDF ke PNG Online | Kits', description: 'Ubah halaman PDF menjadi gambar PNG online dengan Kits. Upload PDF dan unduh hasil PNG.', h1: 'PDF ke PNG Online' },
  },
  'png-to-pdf': {
    en: { title: 'PNG to PDF Converter Online | Kits', description: 'Convert PNG images to PDF online with Kits. Upload PNG files and create a PDF quickly on the server.', h1: 'PNG to PDF Converter' },
    id: { title: 'PNG ke PDF Online | Kits', description: 'Ubah gambar PNG menjadi PDF online dengan Kits. Upload file PNG dan buat PDF dengan cepat.', h1: 'PNG ke PDF Online' },
  },
  'qr-code-generator': {
    en: { title: 'QR Code Generator Online Free | Kits', description: 'Generate QR codes online with Kits. Create QR images for links and text, then download PNG or SVG files.', h1: 'QR Code Generator Online' },
    id: { title: 'QR Code Generator Online | Kits', description: 'Buat QR code online dengan Kits untuk link atau teks, lalu unduh hasilnya sebagai PNG atau SVG.', h1: 'QR Code Generator Online' },
  },
  'word-counter': {
    en: { title: 'Word Counter Online Free | Kits', description: 'Count words and characters online with Kits. Paste text to measure length quickly in your browser.', h1: 'Word Counter Online' },
    id: { title: 'Penghitung Kata Online | Kits', description: 'Hitung jumlah kata dan karakter online dengan Kits. Tempel teks dan lihat panjang tulisan secara cepat.', h1: 'Penghitung Kata Online' },
  },
}

const fallbackSteps = {
  en: ['Open the tool page.', 'Add your file or text.', 'Choose the available options.', 'Process the tool.', 'Download or copy the result.'],
  id: ['Buka halaman tool.', 'Tambahkan file atau teks.', 'Pilih opsi yang tersedia.', 'Jalankan proses.', 'Unduh atau salin hasilnya.'],
}

const fallbackBenefits = {
  en: ['Works in a focused web interface.', 'Uses clear processing labels.', 'Keeps related tools close when you need another conversion.'],
  id: ['Bekerja di antarmuka web yang fokus.', 'Menampilkan label pemrosesan dengan jelas.', 'Menyediakan tool terkait saat Anda perlu konversi lain.'],
}

export function toolSeoPath(locale: Locale, slug: string) {
  return locale === 'id' ? `/id/tools/${slug}` : `/tools/${slug}`
}

export function getToolSeo(tool: ToolDefinition, locale: Locale): ToolSeoCopy {
  const localized = localizeTool(tool, locale)
  const custom = priorityCopy[tool.slug]?.[locale] ?? {}
  const isId = locale === 'id'
  const title = custom.title ?? `${localized.name} Online | ${SITE_NAME}`
  const description = custom.description ?? (isId
    ? `${localized.name} online dengan Kits. ${localized.shortDescription} Pemrosesan ${tool.processingMode === 'client' ? 'berjalan di browser' : 'dilakukan di server Kits'}.`
    : `${localized.name} online with Kits. ${localized.shortDescription} Processing ${tool.processingMode === 'client' ? 'runs in your browser' : 'uses the Kits server'}.`)
  const h1 = custom.h1 ?? (isId ? `${localized.name} Online` : `${localized.name} Online`)
  const intro = custom.intro ?? (isId
    ? `${localized.description} Kits membantu Anda menyelesaikan pekerjaan ini dengan alur yang sederhana dan label pemrosesan yang jelas.`
    : `${localized.description} Kits keeps the workflow simple, shows where processing happens, and links to related utilities when you need the next step.`)
  return {
    title,
    description,
    h1,
    intro,
    steps: custom.steps ?? fallbackSteps[locale],
    benefits: custom.benefits ?? fallbackBenefits[locale],
    faq: custom.faq ?? defaultFaq(tool, locale),
  }
}

function isProTool(tool: ToolDefinition) {
  return tool.accessTier === 'pro' || tool.premium
}

function defaultFaq(tool: ToolDefinition, locale: Locale) {
  const local = localizeTool(tool, locale)
  if (locale === 'id') {
    return [
      { question: `Apakah ${local.name} gratis?`, answer: isProTool(tool) ? 'Tool ini adalah fitur Pro dan memerlukan lisensi aktif untuk memproses file.' : 'Tool ini dapat digunakan tanpa lisensi Pro.' },
      { question: 'Di mana file diproses?', answer: tool.processingMode === 'client' ? 'Pemrosesan berjalan di browser Anda.' : 'Tool ini memakai pemrosesan server Kits untuk menyelesaikan pekerjaan.' },
    ]
  }
  return [
    { question: `Is ${local.name} free?`, answer: isProTool(tool) ? 'This is a Pro feature and requires an active license before processing.' : 'This tool is available without a Pro license.' },
    { question: 'Where is processing handled?', answer: tool.processingMode === 'client' ? 'Processing runs in your browser.' : 'This tool uses temporary Kits server processing.' },
  ]
}

export function toolHead(tool: ToolDefinition, locale: Locale) {
  const copy = getToolSeo(tool, locale)
  const path = toolSeoPath(locale, tool.slug)
  const en = absoluteUrl(toolSeoPath('en', tool.slug))
  const id = absoluteUrl(toolSeoPath('id', tool.slug))
  return {
    meta: [
      { title: copy.title },
      { name: 'description', content: copy.description },
      { property: 'og:title', content: copy.title },
      { property: 'og:description', content: copy.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: absoluteUrl(path) },
      { property: 'og:image', content: seoImage() },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: copy.title },
      { name: 'twitter:description', content: copy.description },
      { name: 'twitter:image', content: seoImage() },
    ],
    links: [
      { rel: 'canonical', href: absoluteUrl(path) },
      { rel: 'alternate', hrefLang: 'en', href: en },
      { rel: 'alternate', hrefLang: 'id', href: id },
      { rel: 'alternate', hrefLang: 'x-default', href: en },
    ],
  }
}

export function toolJsonLd(tool: ToolDefinition, locale: Locale) {
  const copy = getToolSeo(tool, locale)
  const url = absoluteUrl(toolSeoPath(locale, tool.slug))
  const related = getRelatedTools(tool).map((item) => ({ '@type': 'WebPage', name: localizeTool(item, locale).name, url: absoluteUrl(toolSeoPath(locale, item.slug)) }))
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: copy.h1,
      url,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      description: copy.description,
      offers: { '@type': 'Offer', price: isProTool(tool) ? '30000' : '0', priceCurrency: isProTool(tool) ? 'IDR' : 'USD' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: locale === 'id' ? 'Beranda' : 'Home', item: absoluteUrl(locale === 'id' ? '/id' : '/') },
        { '@type': 'ListItem', position: 2, name: categoryLabel(tool.category, locale), item: absoluteUrl(categorySeoPath(locale, tool.category)) },
        { '@type': 'ListItem', position: 3, name: copy.h1, item: url },
      ],
    },
    ...(related.length ? [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: related.map((item, index) => ({ '@type': 'ListItem', position: index + 1, item })) }] : []),
  ]
}

export function categorySeoPath(locale: Locale, category: string) {
  return locale === 'id' ? `/id/tools/${category}` : `/tools/${category}`
}

export function categoryLabel(category: string, locale: Locale) {
  const labels: Record<string, Record<Locale, string>> = {
    image: { en: 'Image Tools', id: 'Tool Gambar' },
    pdf: { en: 'PDF Tools', id: 'Tool PDF' },
    audio: { en: 'Audio Tools', id: 'Tool Audio' },
    video: { en: 'Video Tools', id: 'Tool Video' },
    text: { en: 'Text Tools', id: 'Tool Teks' },
    developer: { en: 'Developer Tools', id: 'Tool Developer' },
    generator: { en: 'Generator Tools', id: 'Tool Generator' },
    qr: { en: 'QR Tools', id: 'Tool QR' },
    converter: { en: 'Converter Tools', id: 'Tool Konverter' },
  }
  return labels[category]?.[locale] ?? category
}

export function websiteJsonLd(locale: Locale) {
  const url = absoluteUrl(locale === 'id' ? '/id' : '/')
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: locale,
    potentialAction: { '@type': 'SearchAction', target: `${url}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
  }
}

export function organizationJsonLd() {
  return { '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: seoImage() }
}

export function toolFromRouteParam(value: string) {
  return getToolBySlug(value)
}
