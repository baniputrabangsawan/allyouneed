import { getRelatedTools, getToolBySlug, type ToolDefinition } from '@/features/tools/tool-registry'
import { getToolPageCopy } from '@/features/tools/tool-content'
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
  'meta-tag-generator': {
    en: {
      title: 'Meta Tag Generator Online Free | Kits',
      description: 'Generate HTML meta tags online with Kits. Build title, description, canonical, and robots tags in your browser, then copy the markup.',
      h1: 'Meta Tag Generator Online',
      intro: 'Create title, description, canonical URL, and robots meta tags without leaving the browser. Values are escaped as you type so the HTML stays valid.',
      benefits: ['Copy ready-to-paste head tags.', 'Soft length hints for title and description.', 'No upload and no account.'],
    },
    id: {
      title: 'Generator Meta Tag Online | Kits',
      description: 'Buat HTML meta tag online dengan Kits. Susun title, description, canonical, dan robots di browser, lalu salin markupnya.',
      h1: 'Generator Meta Tag Online',
      intro: 'Buat title, description, URL kanonis, dan robots meta tag tanpa keluar dari browser. Nilai di-escape saat mengetik agar HTML tetap valid.',
      benefits: ['Salin tag head yang siap tempel.', 'Petunjuk panjang untuk judul dan description.', 'Tanpa unggahan dan tanpa akun.'],
    },
  },
  'open-graph-generator': {
    en: {
      title: 'Open Graph Generator Online Free | Kits',
      description: 'Generate Open Graph and Twitter card tags online with Kits. Preview approximate social cards in your browser, then copy the HTML.',
      h1: 'Open Graph Generator Online',
      intro: 'Create og:title, og:description, og:url, og:image, and Twitter card tags without leaving the browser. The social-style previews are approximate, not pixel-identical to Facebook or X.',
      benefits: ['Copy ready-to-paste Open Graph tags.', 'See approximate Facebook-style and X-style cards.', 'Invalid image URLs are flagged in place.'],
      faq: [
        { question: 'Is Open Graph Generator free?', answer: 'This tool is available without a Pro license.' },
        { question: 'Where is processing handled?', answer: 'Processing runs in your browser. Tags are generated locally and nothing is uploaded.' },
        { question: 'Does the preview match Facebook or X exactly?', answer: 'No. The cards resemble those layouts so you can check title, description, and image, but they are not pixel-identical to third-party platforms.' },
        { question: 'Which image URLs work?', answer: 'Use a public http or https image URL. Relative paths, data URLs, and credentialed URLs are rejected.' },
      ],
    },
    id: {
      title: 'Generator Open Graph Online | Kits',
      description: 'Buat tag Open Graph dan Twitter card online dengan Kits. Pratinjau kartu sosial kira-kira di browser, lalu salin HTML.',
      h1: 'Generator Open Graph Online',
      intro: 'Buat tag og:title, og:description, og:url, og:image, dan Twitter card tanpa keluar dari browser. Pratinjau bergaya sosial adalah perkiraan, bukan identik piksel dengan Facebook atau X.',
      benefits: ['Salin tag Open Graph yang siap tempel.', 'Lihat kartu kira-kira gaya Facebook dan X.', 'URL gambar invalid ditandai di tempat.'],
      faq: [
        { question: 'Apakah Generator Open Graph gratis?', answer: 'Tool ini dapat digunakan tanpa lisensi Pro.' },
        { question: 'Di mana file diproses?', answer: 'Pemrosesan berjalan di browser Anda. Tag dibuat secara lokal dan tidak ada yang diunggah.' },
        { question: 'Apakah pratinjau sama persis dengan Facebook atau X?', answer: 'Tidak. Kartu menyerupai tata letak itu agar judul, description, dan gambar bisa dicek, tetapi tidak identik piksel dengan platform pihak ketiga.' },
        { question: 'URL gambar mana yang didukung?', answer: 'Gunakan URL gambar http atau https publik. Path relatif, data URL, dan URL ber-kredensial ditolak.' },
      ],
    },
  },
  'json-ld-generator': {
    en: {
      title: 'JSON-LD Generator Online Free | Kits',
      description: 'Generate schema.org JSON-LD online with Kits. Build WebSite, Organization, Article, FAQ, and other types in your browser, then copy valid JSON or a script tag.',
      h1: 'JSON-LD Generator Online',
      intro: 'JSON-LD is a JSON format for schema.org structured data. Fill the fields for one type, omit blanks, and copy markup that matches what you entered. Kits does not invent ratings or reviews, and structured data does not guarantee rich results.',
      benefits: [
        'Live JSON preview from the fields you fill in.',
        'Copy JSON-LD or a ready script tag.',
        'Invalid URLs and empty optional fields are omitted.',
        'No fabricated ratings or reviews.',
      ],
      faq: [
        { question: 'Is JSON-LD Generator free?', answer: 'This tool is available without a Pro license.' },
        { question: 'Where is processing handled?', answer: 'Processing runs in your browser. Nothing is uploaded.' },
        { question: 'What is JSON-LD?', answer: 'JSON-LD (JSON for Linking Data) is a way to embed schema.org structured data in a page, usually inside a script type="application/ld+json" tag, so crawlers can read entities like Organization or Article.' },
        { question: 'Will this make rich results appear?', answer: 'No. Valid structured data can help search engines understand a page. Eligibility for rich results still depends on the content, the type, and search-engine policies. This generator does not add fake ratings or reviews.' },
        { question: 'Which schema types are supported?', answer: 'WebSite, Organization, Person, Article, BreadcrumbList, FAQPage, Product, and SoftwareApplication. Only fields for the selected type are shown.' },
      ],
    },
    id: {
      title: 'Generator JSON-LD Online | Kits',
      description: 'Buat schema.org JSON-LD online dengan Kits. Susun WebSite, Organization, Article, FAQ, dan tipe lain di browser, lalu salin JSON valid atau tag script.',
      h1: 'Generator JSON-LD Online',
      intro: 'JSON-LD adalah format JSON untuk structured data schema.org. Isi field satu tipe, kosongkan yang tidak dipakai, dan salin markup sesuai input. Kits tidak mengarang rating atau ulasan, dan structured data tidak menjamin rich result.',
      benefits: [
        'Pratinjau JSON langsung dari field yang diisi.',
        'Salin JSON-LD atau tag script siap pakai.',
        'URL invalid dan field opsional kosong dihilangkan.',
        'Tanpa rating atau ulasan rekaan.',
      ],
      faq: [
        { question: 'Apakah Generator JSON-LD gratis?', answer: 'Tool ini dapat digunakan tanpa lisensi Pro.' },
        { question: 'Di mana file diproses?', answer: 'Pemrosesan berjalan di browser Anda. Tidak ada yang diunggah.' },
        { question: 'Apa itu JSON-LD?', answer: 'JSON-LD (JSON for Linking Data) adalah cara menanamkan structured data schema.org di halaman, biasanya di dalam tag script type="application/ld+json", agar crawler dapat membaca entitas seperti Organization atau Article.' },
        { question: 'Apakah ini membuat rich result muncul?', answer: 'Tidak. Structured data yang valid dapat membantu mesin telusur memahami halaman. Kelayakan rich result tetap bergantung pada konten, tipe, dan kebijakan mesin telusur. Generator ini tidak menambahkan rating atau ulasan palsu.' },
        { question: 'Tipe schema apa yang didukung?', answer: 'WebSite, Organization, Person, Article, BreadcrumbList, FAQPage, Product, dan SoftwareApplication. Hanya field untuk tipe terpilih yang ditampilkan.' },
      ],
    },
  },
  'robots-txt-generator': {
    en: {
      title: 'Robots.txt Generator Online Free | Kits',
      description: 'Generate robots.txt rules online with Kits. Build user-agent groups, Allow and Disallow rules, crawl-delay, and Sitemap entries in your browser.',
      h1: 'Robots.txt Generator Online',
      intro: 'Create a robots.txt file without memorizing crawler syntax. Add bot groups and rules in the builder, or switch to Advanced mode when you want direct control.',
      benefits: ['Build multiple user-agent groups.', 'Copy or download a ready robots.txt file.', 'Get warned before blocking all crawlers.'],
    },
    id: {
      title: 'Generator Robots.txt Online | Kits',
      description: 'Buat aturan robots.txt online dengan Kits. Susun user-agent, Allow, Disallow, crawl-delay, dan Sitemap di browser.',
      h1: 'Generator Robots.txt Online',
      intro: 'Buat file robots.txt tanpa menghafal sintaks crawler. Tambahkan grup bot dan aturan di builder, atau gunakan Advanced mode untuk kontrol langsung.',
      benefits: ['Buat beberapa grup user-agent.', 'Salin atau unduh file robots.txt siap pakai.', 'Dapatkan peringatan sebelum memblokir semua crawler.'],
    },
  },
}


export function toolSeoPath(locale: Locale, slug: string) {
  return locale === 'id' ? `/id/tools/${slug}` : `/tools/${slug}`
}

export function getToolSeo(tool: ToolDefinition, locale: Locale): ToolSeoCopy {
  const localized = localizeTool(tool, locale)
  const page = getToolPageCopy(tool.slug, locale)
  const custom = priorityCopy[tool.slug]?.[locale] ?? {}
  const isId = locale === 'id'
  const processing = tool.processingMode === 'client'
    ? (isId ? 'Pemrosesan berjalan di browser.' : 'Processing runs in your browser.')
    : (isId ? 'Pemrosesan memakai server Kits.' : 'Processing uses the Kits server.')
  const title = custom.title ?? `${localized.name} Online | ${SITE_NAME}`
  const description = custom.description ?? (page
    ? `${page.shortDescription} ${processing}`
    : `${localized.name} online with Kits. ${localized.shortDescription}`)
  const h1 = custom.h1 ?? `${localized.name} Online`
  const intro = custom.intro ?? page?.intro ?? localized.description
  return {
    title,
    description,
    h1,
    intro,
    steps: custom.steps ?? page?.howTo ?? [],
    benefits: custom.benefits ?? page?.benefits ?? [],
    faq: custom.faq ?? defaultFaq(tool, locale),
  }
}


function defaultFaq(tool: ToolDefinition, locale: Locale) {
  const local = localizeTool(tool, locale)
  if (locale === 'id') {
    return [
      { question: `Apakah ${local.name} gratis?`, answer: tool.requiresPro ? 'Tool ini adalah fitur Pro dan memerlukan lisensi aktif untuk memproses file.' : 'Tool ini dapat digunakan tanpa lisensi Pro.' },
      { question: 'Di mana file diproses?', answer: tool.processingMode === 'client' ? 'Pemrosesan berjalan di browser Anda.' : 'Tool ini memakai pemrosesan server Kits untuk menyelesaikan pekerjaan.' },
    ]
  }
  return [
    { question: `Is ${local.name} free?`, answer: tool.requiresPro ? 'This is a Pro feature and requires an active license before processing.' : 'This tool is available without a Pro license.' },
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
      offers: { '@type': 'Offer', price: tool.requiresPro ? '30000' : '0', priceCurrency: tool.requiresPro ? 'IDR' : 'USD' },
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
