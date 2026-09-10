# MASTER PROMPT — FRONTEND ALL-IN-ONE UTILITY WEB APP

## ROLE

Bertindak sebagai **Senior Frontend Engineer, Frontend Architect, UI/UX Engineer, Design System Engineer, dan Performance Engineer**.

Bangun frontend production-ready untuk sebuah **All-in-One Utility Web App** yang menyediakan berbagai tool online dalam satu platform, mencakup:

- Image tools
- QR / QRIS / Barcode tools
- PDF tools
- Audio tools
- Video tools
- Text tools
- Converter tools
- Generator tools
- Developer tools
- AI-powered tools

Fokus prompt ini **HANYA FRONTEND**.

Jangan mengimplementasikan:

- database
- backend Python/FastAPI
- authentication server-side
- Redis
- storage server
- queue
- worker server
- payment gateway
- server security infrastructure

Tetapi frontend harus disiapkan agar nantinya dapat terhubung dengan backend melalui API abstraction yang bersih.

---

# 1. PRODUCT CONCEPT

Buat aplikasi dengan positioning:

> **One website. Every tool you need.**

Tujuan produk:

- Cepat.
- Bersih.
- Profesional.
- Mudah digunakan.
- Responsive.
- Privacy-first.
- SEO-friendly.
- Modular.
- Bisa berkembang dari puluhan menjadi ratusan utility.
- Mayoritas tool sederhana diproses langsung di browser.
- Tool berat nantinya dapat dikirim ke backend melalui API.
- Pengguna tidak wajib login untuk menggunakan tool dasar.

Aplikasi tidak boleh terlihat seperti kumpulan halaman acak.

Semua tool harus terasa sebagai bagian dari satu platform yang konsisten.

---

# 2. FRONTEND TECH STACK

Gunakan stack berikut.

```text
Framework
TanStack Start

UI Runtime
React

Language
TypeScript

Build Tool
Vite

Package Manager
pnpm

Styling
Tailwind CSS

Component System
shadcn/ui
Radix UI

Icons
Lucide React

Routing
TanStack Router

Server State
TanStack Query

Forms
TanStack Form

Validation
Zod

Search
Fuse.js

Class Utilities
clsx
tailwind-merge
class-variance-authority

Testing
Vitest
React Testing Library
Playwright

Formatting
Prettier

Linting
ESLint
```

Jangan gunakan:

```text
Next.js
Nuxt
Vue
Angular
jQuery
Bootstrap
Material UI
Ant Design
```

Jangan menambahkan library besar jika fungsi yang sama dapat dilakukan dengan browser API.

---

# 3. TYPESCRIPT RULES

Gunakan TypeScript strict mode.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Hindari:

```ts
any
```

Gunakan:

```ts
unknown
```

jika tipe belum diketahui, kemudian lakukan validation/narrowing.

Semua:

- props
- hooks
- services
- utility
- processing result
- API response
- tool configuration

harus mempunyai type yang jelas.

---

# 4. PACKAGE MANAGER

Gunakan hanya:

```text
pnpm
```

Standard command:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Gunakan hanya satu:

```text
pnpm-lock.yaml
```

Jangan membuat:

```text
package-lock.json
yarn.lock
bun.lock
```

---

# 5. FRONTEND ARCHITECTURE

Gunakan feature-based architecture.

Struktur utama:

```text
apps/
└── web/
    ├── public/
    │
    └── src/
        ├── routes/
        │
        ├── features/
        │   ├── tools/
        │   ├── search/
        │   ├── image/
        │   ├── qr/
        │   ├── pdf/
        │   ├── audio/
        │   ├── video/
        │   ├── text/
        │   ├── developer/
        │   └── generator/
        │
        ├── components/
        │   ├── ui/
        │   ├── layout/
        │   ├── tool/
        │   ├── file/
        │   └── common/
        │
        ├── processing/
        │   ├── client/
        │   ├── adapters/
        │   └── types/
        │
        ├── workers/
        │
        ├── hooks/
        │
        ├── lib/
        │
        ├── config/
        │
        ├── constants/
        │
        ├── types/
        │
        ├── styles/
        │
        └── assets/
```

---

# 6. FEATURE STRUCTURE

Setiap tool kompleks harus mempunyai module sendiri.

Contoh:

```text
features/
└── image/
    └── compress-image/
        ├── components/
        │   ├── compression-options.tsx
        │   ├── compression-result.tsx
        │   └── image-preview.tsx
        │
        ├── hooks/
        │   └── use-image-compression.ts
        │
        ├── lib/
        │   ├── compress-image.ts
        │   └── calculate-savings.ts
        │
        ├── schemas/
        │   └── compression.schema.ts
        │
        ├── types/
        │   └── compression.types.ts
        │
        └── index.ts
```

Jangan memasukkan seluruh logic ke dalam satu component.

---

# 7. CORE ARCHITECTURE PRINCIPLE

Pisahkan dengan jelas:

```text
UI
↓
Feature Hook
↓
Processing Adapter
↓
Browser Processor / API Processor
```

Contoh:

```text
CompressImagePage
       ↓
useImageCompression()
       ↓
imageCompressionService
       ↓
clientProcessor
```

Untuk fitur backend nantinya:

```text
RemoveBackgroundPage
       ↓
useBackgroundRemoval()
       ↓
backgroundRemovalService
       ↓
remoteProcessor
```

UI tidak boleh tahu detail implementasi backend.

---

# 8. PROCESSING ABSTRACTION

Buat interface generik.

```ts
export type ProcessingStatus =
  | "idle"
  | "validating"
  | "preparing"
  | "processing"
  | "uploading"
  | "queued"
  | "completed"
  | "failed"
  | "cancelled";

export interface ProcessingProgress {
  progress: number;
  stage?: string;
}

export interface ProcessingResult<T> {
  data: T;
  duration?: number;
}

export interface Processor<TInput, TOutput> {
  process(
    input: TInput,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: ProcessingProgress) => void;
    }
  ): Promise<ProcessingResult<TOutput>>;
}
```

Gunakan adapter agar tool dapat berpindah dari:

```text
client processing
```

ke:

```text
remote processing
```

tanpa merombak UI.

---

# 9. PROCESSING MODE

Definisikan:

```ts
export type ProcessingMode =
  | "client"
  | "remote"
  | "hybrid";
```

Tool registry harus mengetahui mode tersebut.

Contoh:

```text
Resize Image
client

QR Generator
client

JSON Formatter
client

Background Removal
remote

AI Upscale
remote

Speech To Text
remote

Image Compression
hybrid
```

---

# 10. TOOL REGISTRY

Jangan hardcode tool pada homepage.

Buat satu centralized registry.

Contoh:

```ts
export type ToolCategory =
  | "image"
  | "pdf"
  | "audio"
  | "video"
  | "qr"
  | "text"
  | "developer"
  | "generator"
  | "converter";

export type ToolGroup =
  | "optimize"
  | "create"
  | "edit"
  | "convert"
  | "security";

export interface ToolDefinition {
  id: string;
  slug: string;

  name: string;
  shortDescription: string;
  description: string;

  category: ToolCategory;
  groups: ToolGroup[];

  tags: string[];
  aliases: string[];

  icon: string;

  processingMode: ProcessingMode;

  acceptedFormats?: string[];
  outputFormats?: string[];

  new?: boolean;
  popular?: boolean;
  ai?: boolean;

  seo: {
    title: string;
    description: string;
  };
}
```

Contoh:

```ts
{
  id: "compress-image",
  slug: "compress-image",

  name: "Compress Image",

  shortDescription:
    "Reduce image file size while preserving visual quality.",

  description:
    "Compress JPG, PNG, WebP and AVIF images directly from your browser.",

  category: "image",

  groups: ["optimize"],

  tags: [
    "image",
    "compress",
    "optimize",
    "reduce size"
  ],

  aliases: [
    "compress photo",
    "shrink image",
    "reduce image",
    "kompres gambar",
    "perkecil foto"
  ],

  icon: "ImageDown",

  processingMode: "client",

  acceptedFormats: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif"
  ],

  popular: true,

  seo: {
    title: "Compress Image Online — Fast & Private",
    description:
      "Compress JPG, PNG, WebP and AVIF images online directly from your browser."
  }
}
```

---

# 11. TOOL REGISTRY FUNCTIONS

Buat helper:

```ts
getAllTools()

getToolBySlug()

getToolsByCategory()

getToolsByGroup()

getRelatedTools()

getPopularTools()

searchTools()
```

Semua sumber berikut harus menggunakan registry:

```text
Homepage
Category page
Search
Command palette
Related tools
Navigation
Sitemap
SEO metadata
```

Jangan membuat duplicate tool list.

---

# 12. TOOL CATEGORIES

Gunakan kategori utama:

```text
All Tools
Image
PDF
Audio
Video
QR
Converter
Text
Generator
Developer
```

Gunakan secondary filters:

```text
All
Optimize
Create
Edit
Convert
Security
```

---

# 13. TOOLS — IMAGE

Masukkan:

```text
Compress Image
Resize Image
Crop Image
Rotate Image
Flip Image

Convert to JPG
Convert from JPG
Image Converter

JPG to PNG
PNG to JPG
JPG to WebP
PNG to WebP
WebP to JPG
AVIF Converter
HEIC Converter
SVG to PNG
TIFF Converter

Photo Editor
Watermark Image
Blur Face
Blur Area
Pixelate Image

Remove Background
Replace Background
Background Blur

Upscale Image
Image Enhancement

Meme Generator
HTML to Image
Website Screenshot

Image to Base64
Base64 to Image

Image Metadata Viewer
Remove Metadata

Color Picker
Palette Generator

Favicon Generator
Profile Picture Maker
Passport Photo Maker
Thumbnail Generator

Social Media Image Resizer
```

---

# 14. TOOLS — QR / QRIS / BARCODE

Masukkan:

```text
QR Code Generator
URL QR Code
Text QR Code
WiFi QR Code
WhatsApp QR Code
Email QR Code
Phone QR Code
vCard QR Code
Location QR Code

QR Code Reader

QRIS Reader
QRIS Payload Parser

Barcode Generator
Barcode Reader
```

Format export:

```text
PNG
SVG
```

Tambahkan PDF hanya jika implementasinya benar-benar tersedia.

---

# 15. TOOLS — AUDIO

Masukkan:

```text
Text to Speech
Speech to Text

Audio Converter
Audio Compressor

Audio Cutter
Audio Trimmer
Audio Merger

Change Audio Speed
Change Volume

Remove Silence
Noise Reduction

Extract Audio From Video

Voice Recorder
```

---

# 16. TOOLS — PDF

Masukkan:

```text
Compress PDF
Merge PDF
Split PDF

JPG to PDF
PNG to PDF

PDF to JPG
PDF to PNG

Rotate PDF
Delete PDF Pages
Reorder PDF Pages
Extract PDF Pages

Watermark PDF
Page Number PDF

Protect PDF
Unlock PDF

PDF Metadata Viewer

PDF to Text
OCR PDF

HTML to PDF
```

---

# 17. TOOLS — VIDEO

Masukkan:

```text
Video Compressor
Video Converter

Video to GIF
GIF to Video

Video Cutter
Video Trimmer
Video Merger

Resize Video
Crop Video
Rotate Video

Remove Audio
Extract Audio
Add Audio

Change Video Speed

Generate Thumbnail

Add Watermark
Add Subtitle

Video Screenshot
Video Metadata Viewer
```

---

# 18. TOOLS — TEXT

Masukkan:

```text
Word Counter
Character Counter

Case Converter

Remove Duplicate Lines
Remove Extra Spaces
Sort Lines

Text Cleaner
Text Formatter

Lorem Ipsum Generator

Slug Generator

Text Compare
Text Diff

Markdown Preview
Markdown to HTML
HTML to Markdown

Text to Image
```

---

# 19. TOOLS — DEVELOPER

Masukkan:

```text
JSON Formatter
JSON Validator
JSON Minifier

XML Formatter
XML to JSON

YAML to JSON
JSON to YAML

HTML Formatter
CSS Formatter
JavaScript Formatter

Base64 Encode
Base64 Decode

URL Encode
URL Decode

JWT Decoder

UUID Generator

Hash Generator
SHA-256
SHA-512

Regex Tester

Cron Expression Generator

Unix Timestamp Converter

HEX RGB HSL Converter
```

---

# 20. TOOLS — GENERATOR

Masukkan:

```text
Password Generator
PIN Generator
Random Number Generator

UUID Generator

QR Generator
Barcode Generator

Gradient Generator
CSS Shadow Generator
Border Radius Generator

Color Palette Generator

Placeholder Image Generator
Avatar Generator

Signature Generator

Invoice Generator
Receipt Generator
Certificate Generator
```

---

# 21. CLIENT-SIDE PROCESSING

Gunakan browser processing sebanyak mungkin.

Gunakan:

```text
File API
Blob
Object URL
Canvas API
OffscreenCanvas
Web Workers
WebAssembly
Web Audio API
MediaRecorder API
Clipboard API
```

---

# 22. IMAGE CLIENT STACK

Gunakan bila memang diperlukan:

```text
browser-image-compression
pica
exifr
Canvas API
```

Jangan langsung memasukkan semua library ke initial bundle.

Gunakan dynamic import.

Contoh:

```ts
const imageCompression = await import(
  "browser-image-compression"
);
```

---

# 23. WEB WORKER

Jangan menjalankan proses CPU-heavy pada main thread.

Gunakan worker untuk:

```text
Image compression
Large image resize
Image conversion
Hash calculation
Heavy text processing
Large JSON formatting
```

Struktur:

```text
src/
└── workers/
    ├── image-compression.worker.ts
    ├── image-resize.worker.ts
    ├── image-convert.worker.ts
    └── hash.worker.ts
```

---

# 24. WEB WORKER COMMUNICATION

Gunakan typed messages.

```ts
type WorkerMessage =
  | {
      type: "START";
      payload: unknown;
    }
  | {
      type: "CANCEL";
    };

type WorkerResponse =
  | {
      type: "PROGRESS";
      progress: number;
    }
  | {
      type: "SUCCESS";
      result: unknown;
    }
  | {
      type: "ERROR";
      error: string;
    };
```

Buat wrapper agar component tidak berkomunikasi dengan Worker API secara langsung.

---

# 25. BLOB MANAGEMENT

Gunakan:

```ts
URL.createObjectURL(blob)
```

untuk preview dan download.

Wajib cleanup:

```ts
URL.revokeObjectURL(url)
```

Jangan menyimpan Blob besar ke:

```text
localStorage
sessionStorage
global React state
URL query
```

---

# 26. GLOBAL STATE

Jangan menambah Redux.

Gunakan:

```text
React local state
TanStack Query
Context untuk state benar-benar global
URL search params untuk filter/search
localStorage untuk preference ringan
```

Jangan menyimpan semua state aplikasi dalam satu global store.

---

# 27. API LAYER

Meskipun backend belum dibuat, siapkan frontend API abstraction.

Struktur:

```text
src/
└── lib/
    └── api/
        ├── client.ts
        ├── jobs.ts
        ├── files.ts
        └── types.ts
```

Gunakan:

```ts
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;
```

Jangan hardcode URL backend.

---

# 28. API CLIENT

Buat wrapper terhadap `fetch`.

Support:

```text
base URL
JSON parsing
typed error
timeout
AbortSignal
credentials config
HTTP status handling
```

Jangan memasukkan API token private ke frontend.

---

# 29. DESIGN DIRECTION

Gunakan visual yang terinspirasi layout utility website pada referensi:

```text
Light lavender / off-white background
Large white cards
Thin borders
Soft category icon tiles
Pill category filters
Large whitespace
Dark charcoal typography
Very subtle shadow
Rounded cards
Modern SaaS utility appearance
```

Target:

```text
clean
professional
minimal
soft
accessible
fast
```

Bukan:

```text
gaming
cyberpunk
neon
glassmorphism-heavy
3D-heavy
gradient-heavy
```

---

# 30. COLOR DESIGN SYSTEM

Gunakan CSS variables.

```css
:root {
  --background: #f7f7fc;
  --foreground: #292934;

  --surface: #ffffff;
  --surface-secondary: #f2f2f7;

  --card: #ffffff;
  --card-foreground: #30303a;

  --muted: #f1f1f6;
  --muted-foreground: #71717c;

  --border: #dedee7;
  --input: #e2e2e9;

  --primary: #292934;
  --primary-foreground: #ffffff;

  --accent: #eef0ff;
  --accent-foreground: #292934;

  --success: #4caf50;
  --warning: #dca900;
  --danger: #d84f5f;
  --info: #159dc0;
}
```

---

# 31. DARK MODE

Support:

```text
Light
Dark
System
```

Contoh token:

```css
.dark {
  --background: #111114;
  --foreground: #f3f3f5;

  --surface: #18181c;
  --surface-secondary: #202025;

  --card: #19191e;
  --card-foreground: #f4f4f6;

  --muted: #222227;
  --muted-foreground: #a0a0aa;

  --border: #303037;
  --input: #34343b;

  --primary: #f4f4f6;
  --primary-foreground: #18181c;

  --accent: #292936;
  --accent-foreground: #f4f4f6;
}
```

Jangan membuat dark mode hanya dengan:

```text
filter: invert()
```

---

# 32. CATEGORY COLORS

Warna hanya digunakan sebagai accent.

```text
Optimize  = green
Create    = cyan
Edit      = pink
Convert   = yellow
Security  = blue

Image     = lime / green
PDF       = red
Audio     = violet
Video     = indigo
QR        = teal
Developer = slate
Generator = amber
```

Gunakan pada:

```text
icon background
small badge
small indicator
```

Bukan seluruh card.

---

# 33. TYPOGRAPHY

Gunakan:

```text
Inter Variable
```

Fallback:

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Typography scale:

```text
Display
48px / 56px

H1
40px / 48px

H2
32px / 40px

H3
24px / 32px

Card Title
20px / 28px

Body
16px / 24px

Small
14px / 20px

Caption
12px / 16px
```

---

# 34. SPACING SYSTEM

Gunakan 4px base grid.

```text
4
8
12
16
20
24
32
40
48
64
80
96
```

Container:

```text
max-width: 1560px
margin-inline: auto
```

Padding:

```text
Desktop besar:
48–64px

Desktop:
32–40px

Tablet:
24px

Mobile:
16px
```

---

# 35. RADIUS

Gunakan:

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
```

Tool card:

```text
16px
```

Buttons:

```text
10–12px
```

Pill:

```text
9999px
```

---

# 36. BORDER

Default:

```text
1px solid var(--border)
```

Card tidak membutuhkan heavy shadow.

---

# 37. SHADOW

Default:

```text
none
```

atau sangat ringan.

Hover:

```text
subtle shadow
```

Jangan gunakan shadow besar.

---

# 38. MOTION

Gunakan animasi hanya untuk functional feedback.

Contoh:

```text
card hover
button press
modal
dropdown
progress
toast
before/after comparison
```

Duration:

```text
150–250ms
```

Gunakan:

```text
ease-out
```

Hormati:

```css
@media (prefers-reduced-motion: reduce)
```

---

# 39. RESPONSIVE GRID

Tool cards:

```text
>= 1440px
5 columns

1200–1439px
4 columns

768–1199px
2–3 columns

< 768px
1 column
```

Jangan memaksakan 2 card pada mobile kecil jika teks menjadi sempit.

---

# 40. APP SHELL

Struktur:

```text
App
├── Header
├── Main
└── Footer
```

Header:

```text
Logo

All Tools
Image
PDF
Audio
Video
QR
Convert
Developer

Search

Theme Toggle
```

Mobile:

```text
Logo
Search
Menu
```

---

# 41. HEADER

Gunakan sticky header.

Requirement:

```text
height sekitar 64–72px
background semi-solid
bottom border
optional backdrop blur ringan
```

Jangan membuat header terlalu tinggi.

---

# 42. HOMEPAGE

Struktur:

```text
Header

Hero
Global Search
Category Filters

Popular Tools

All Tools Grid

Why Use This Platform

Privacy Section

Footer
```

---

# 43. HERO

Heading:

```text
Every Tool You Need.
In One Place.
```

Subheading:

```text
Compress, convert, edit, generate, and process files directly from your browser.
Fast, private, and simple.
```

Gunakan hero sederhana.

Jangan menambahkan ilustrasi 3D besar yang memperlambat website.

---

# 44. GLOBAL SEARCH

Search harus menjadi salah satu elemen terpenting.

Placeholder:

```text
Search tools...
```

Examples:

```text
Compress Image
QR Code
PDF to JPG
Text to Speech
Remove Background
JSON Formatter
```

Search berdasarkan:

```text
name
description
tags
aliases
category
```

Gunakan Fuse.js.

---

# 45. SEARCH ALIASES

Contoh:

```text
Compress Image

compress
compress photo
compress image
shrink image
reduce file size
kompres foto
kompres gambar
perkecil gambar
```

Remove Background:

```text
remove bg
background remover
remove background
hapus background
hapus latar
hapus latar belakang
```

---

# 46. SEARCH UX

Support:

```text
keyboard navigation
Arrow Up
Arrow Down
Enter
Escape
```

Shortcut:

```text
/
```

untuk focus search.

Support:

```text
Ctrl + K
Cmd + K
```

untuk command palette.

---

# 47. CATEGORY FILTER

Gunakan horizontal pills.

```text
All
Optimize
Create
Edit
Convert
Security
Image
PDF
Audio
Video
QR
Developer
```

Active:

```text
dark background
white text
```

Inactive:

```text
white background
thin border
dark text
```

Mobile:

```text
horizontal scrolling
```

Tidak boleh membuat page horizontal overflow.

---

# 48. TOOL CARD

Gunakan reusable:

```tsx
<ToolCard tool={tool} />
```

Struktur:

```text
┌──────────────────────────┐
│ [ICON]             [New] │
│                          │
│ Compress Image           │
│                          │
│ Reduce image file size   │
│ while preserving visual  │
│ quality.                 │
│                          │
│ Image · Optimize · Local │
└──────────────────────────┘
```

---

# 49. TOOL CARD BADGES

Badge:

```text
Local
Server
AI
New
```

Tidak perlu semuanya sekaligus.

Contoh:

```text
Compress Image
Local

Remove Background
AI

Video Compressor
Server
```

Badge harus menjelaskan processing sebenarnya.

---

# 50. CARD INTERACTION

Entire card clickable.

Hover:

```text
translateY(-2px)
border sedikit lebih gelap
subtle shadow
```

Focus:

```text
visible focus ring
```

Jangan membuat hover scale besar.

---

# 51. TOOL PAGE TEMPLATE

Buat satu generic layout:

```text
Breadcrumb

Tool Header
Title
Description
Processing Badge

Tool Workspace

How It Works

Privacy Information

FAQ

Related Tools
```

---

# 52. GENERIC WORKSPACE

Struktur:

```text
ToolWorkspace
├── Input
├── Preview
├── Options
├── Action
├── Progress
└── Result
```

---

# 53. FILE DROPZONE

Buat reusable:

```tsx
<FileDropzone />
```

Support:

```text
drag
drop
click browse
paste clipboard jika relevan
single file
multiple file
```

Properties:

```ts
interface FileDropzoneProps {
  accept?: string[];
  multiple?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  onFilesSelected: (files: File[]) => void;
}
```

---

# 54. DROPZONE UI

Empty:

```text
Drop your files here

or

Browse files

JPG, PNG, WebP
Maximum 25 MB
```

Dragging:

```text
Drop files to upload
```

Error:

```text
Unsupported file format
```

---

# 55. FILE LIST

Tampilkan:

```text
thumbnail
filename
format
dimensions
size
remove button
status
```

Contoh:

```text
photo.jpg

4032 × 3024
JPEG
8.4 MB
```

---

# 56. FILE VALIDATION

Validate:

```text
type
extension
size
number of files
```

Jangan hanya mengandalkan:

```html
accept=""
```

Buat runtime validation.

---

# 57. PROCESSING STATE

Jangan menggunakan:

```ts
const [loading, setLoading] = useState(false);
```

sebagai satu-satunya state.

Gunakan:

```ts
type ToolState =
  | { status: "idle" }
  | { status: "ready" }
  | { status: "processing"; progress: number }
  | { status: "completed" }
  | { status: "failed"; error: ToolError };
```

---

# 58. PROGRESS UI

Tampilkan:

```text
Processing 3 of 8
64%

Optimizing PNG...
```

Jika progress asli tidak tersedia, gunakan indeterminate state.

Jangan menggunakan fake percentage.

---

# 59. CANCELLATION

Gunakan:

```text
AbortController
```

untuk proses yang dapat dibatalkan.

UI:

```text
Cancel
```

Setelah cancel:

```text
status = cancelled
```

---

# 60. RESULT UI

Compression example:

```text
Original
8.4 MB

Compressed
1.7 MB

Saved
79.8%

Processing
1.3 s

Download
```

---

# 61. BATCH RESULT

Support:

```text
Download individually
Download all
```

Untuk ZIP client-side gunakan library ringan yang sesuai hanya ketika diperlukan.

Lazy-load library ZIP.

---

# 62. IMAGE COMPRESSION PAGE

UI:

```text
Compress Image

[Upload Area]

Compression Mode

○ Lossless
● Smart
○ Maximum

Advanced Settings

Quality
Output Format
Preserve Metadata
Resize Before Compression

[Compress Images]
```

---

# 63. COMPRESSION MODE

Definisi:

```text
Lossless
Preserve image data whenever format supports it.
Smaller reduction.

Smart
Balance file size and visual quality.

Maximum
Prioritize smallest output size.
```

Jangan menjanjikan:

```text
100% same quality
```

untuk lossy compression.

---

# 64. IMAGE RESIZE PAGE

Input:

```text
Width
Height

Lock Aspect Ratio

Pixels
Percentage

Preset
```

Preset:

```text
Instagram Post
Instagram Story
YouTube Thumbnail
Facebook Post
X Post
LinkedIn Post
Custom
```

---

# 65. IMAGE CROP

Gunakan visual crop interaction.

Features:

```text
Free
1:1
4:3
3:2
16:9
9:16
Custom
```

Support:

```text
zoom
pan
rotate
reset
```

---

# 66. IMAGE CONVERTER

UI:

```text
Input Files

Convert To

JPG
PNG
WebP
AVIF

Quality

Background Color
```

Jika:

```text
PNG transparent
↓
JPG
```

beri pilihan background.

Default:

```text
white
```

---

# 67. REMOVE BACKGROUND FRONTEND

Frontend saja.

Backend belum diimplementasikan.

UI:

```text
Upload Image

[Original Preview]

Processing

[Result]

Before / After slider

Background:
Transparent
White
Custom Color
Upload Image

Download PNG
```

Processing abstraction gunakan:

```text
remote
```

Jangan membuat fake removal.

Sediakan mock adapter hanya untuk development jika perlu dan beri nama jelas sebagai mock.

---

# 68. AI UPSCALE FRONTEND

UI:

```text
Upload

Scale

2×
4×

Enhancement

Standard
Photo
Illustration

Process

Before / After

Download
```

Actual processing nantinya melalui backend.

---

# 69. QR GENERATOR

QR generator harus dapat bekerja client-side.

Fields:

```text
Type
Content
Size
Foreground
Background
Error Correction
Margin
Logo
```

QR types:

```text
URL
Text
WiFi
WhatsApp
Email
Phone
vCard
Location
```

---

# 70. QR RESULT

Preview live.

Buttons:

```text
Download PNG
Download SVG
Copy
```

Pastikan QR tetap dapat discan.

---

# 71. QR READER

Support:

```text
Upload image
Camera
Clipboard
```

Hanya meminta permission camera setelah user memilih camera mode.

---

# 72. QRIS

Pisahkan dengan jelas:

```text
QRIS Reader
QRIS Payload Parser
```

Jangan membuat UI seolah-olah dapat menghasilkan QRIS pembayaran valid jika belum terhubung provider resmi.

---

# 73. TEXT TO SPEECH

Frontend UI:

```text
Text

0 / 5000

Language
Voice
Speed
Pitch

Preview
Generate
```

Free/browser mode dapat memakai:

```text
Web Speech API
```

---

# 74. TTS STATE

Bedakan:

```text
browser
remote
```

Jika browser voice:

```text
Processed on your device
```

Jika remote:

```text
Server processing
```

Jangan menyatakan downloadable MP3 jika browser API tidak menyediakan binary audio.

---

# 75. SPEECH TO TEXT

Frontend:

```text
Upload Audio

File Preview

Language
Auto Detect

Transcribe

Progress

Transcript

Copy
Download TXT
```

Actual inference:

```text
remote
```

---

# 76. PDF UI

Semua PDF tool harus memakai visual language yang sama.

PDF file preview:

```text
thumbnail
page number
filename
size
```

Untuk Merge:

```text
drag to reorder
```

Untuk Split:

```text
page selection
ranges
```

---

# 77. VIDEO UI

Video preview gunakan:

```html
<video controls />
```

Jangan autoplay dengan suara.

Input dapat menampilkan:

```text
resolution
duration
format
size
```

---

# 78. AUDIO UI

Gunakan:

```html
<audio controls />
```

Tampilkan:

```text
duration
format
size
```

---

# 79. DEVELOPER TOOL LAYOUT

Gunakan editor split-layout.

Contoh JSON Formatter:

```text
Input                       Output

{...}                       {
                               ...
                            }

[Format]
[Minify]
[Copy]
[Clear]
```

Desktop:

```text
2 columns
```

Mobile:

```text
stacked
```

---

# 80. MONACO EDITOR

Jangan otomatis menggunakan Monaco untuk semua text utility.

Monaco berat.

Untuk JSON/XML sederhana gunakan textarea/code editor ringan.

Jika Monaco benar-benar dibutuhkan:

```text
lazy-load
```

---

# 81. FAVORITES

Guest favorites:

```text
localStorage
```

Contoh key:

```text
utility:favorites
```

Tidak membutuhkan login.

---

# 82. RECENT TOOLS

Simpan maksimal:

```text
8–12 tools
```

ke localStorage.

Contoh:

```text
utility:recent-tools
```

Jangan menyimpan file atau content user.

---

# 83. USER PREFERENCES

localStorage hanya untuk:

```text
theme
favorites
recent tools
search history optional
tool preferences non-sensitive
```

Jangan untuk:

```text
uploaded image
PDF
audio
video
QR payload sensitif
JWT
private document
```

---

# 84. COMMAND PALETTE

Shortcut:

```text
Ctrl + K
Cmd + K
```

Isi:

```text
Search tools
Popular tools
Recent tools
Categories
Theme
```

Gunakan shadcn Command.

---

# 85. URL STATE

Gunakan URL untuk:

```text
search query
category
group/filter
```

Contoh:

```text
/tools?q=image&category=image
```

Supaya:

```text
back button
bookmark
share
```

berfungsi dengan baik.

---

# 86. ROUTES

Gunakan clean URLs.

```text
/
```

Categories:

```text
/tools
/tools/image
/tools/pdf
/tools/audio
/tools/video
/tools/qr
/tools/text
/tools/developer
/tools/generator
```

Tool:

```text
/compress-image
/resize-image
/crop-image
/image-converter

/remove-background
/upscale-image

/qr-code-generator
/qr-code-reader
/qris-reader

/text-to-speech
/speech-to-text

/compress-pdf
/merge-pdf

/video-compressor

/json-formatter
/base64-encoder
```

---

# 87. 404 PAGE

Custom page:

```text
Tool not found
```

Tampilkan:

```text
Search tools
Popular tools
Back to all tools
```

---

# 88. SEO

Setiap tool harus mempunyai:

```text
title
description
canonical
OpenGraph
structured data jika relevan
```

Metadata berasal dari registry.

---

# 89. TOOL SEO TITLE

Contoh:

```text
Compress Image Online — Fast & Private
```

```text
Resize Image Online — Free Image Resizer
```

```text
QR Code Generator — Create QR Codes Online
```

Hindari keyword stuffing.

---

# 90. RELATED TOOLS

Bottom page:

```text
Related Tools
```

Gunakan category + tags dari registry.

Contoh Compress Image:

```text
Resize Image
Convert Image
Remove Metadata
Crop Image
```

---

# 91. BREADCRUMBS

Contoh:

```text
Home
>
Image
>
Compress Image
```

---

# 92. EMPTY STATES

Buat reusable:

```text
EmptyState
```

Contoh:

```text
No files selected
```

```text
No tools found
```

---

# 93. ERROR MODEL

Gunakan:

```ts
export type ToolErrorCode =
  | "UNSUPPORTED_FORMAT"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE"
  | "PROCESSING_FAILED"
  | "OUT_OF_MEMORY"
  | "NETWORK_ERROR"
  | "RATE_LIMITED"
  | "SERVER_ERROR";

export interface ToolError {
  code: ToolErrorCode;
  message: string;
}
```

---

# 94. USER ERROR MESSAGE

Contoh:

```text
This image format isn't supported.
```

Bukan:

```text
DOMException: Failed to execute...
```

Technical error hanya untuk console development/error monitoring.

---

# 95. ACCESSIBILITY

Target:

```text
WCAG 2.2 AA
```

Wajib:

```text
semantic HTML
keyboard navigation
visible focus
aria labels
aria-live untuk processing
accessible dialogs
sufficient contrast
44×44 touch targets
form labels
error description
```

---

# 96. DROPZONE ACCESSIBILITY

Dropzone harus dapat digunakan dengan:

```text
mouse
keyboard
screen reader
```

Gunakan actual:

```html
<input type="file">
```

yang tetap accessible.

---

# 97. PERFORMANCE

Target Lighthouse production:

```text
Performance     >= 90
Accessibility   >= 95
Best Practices  >= 95
SEO             >= 95
```

Core Web Vitals:

```text
LCP <= 2.5s
INP <= 200ms
CLS <= 0.1
```

---

# 98. INITIAL BUNDLE

Homepage tidak boleh memuat:

```text
FFmpeg
OCR engine
AI model
PDF engine besar
image processing library berat
Monaco
ZIP library
```

jika belum digunakan.

Gunakan lazy loading.

---

# 99. ROUTE CODE SPLITTING

Setiap tool besar harus code-split.

Contoh:

```text
Homepage
↓
small bundle

User membuka Video Converter
↓
baru load video dependencies
```

---

# 100. IMAGE PERFORMANCE

Gunakan:

```text
width
height
lazy loading
responsive sizes
modern formats
```

untuk UI assets.

Jangan membuat CLS.

---

# 101. MEMORY MANAGEMENT

Setelah file selesai:

```text
terminate worker
revoke object URL
release references
clear temporary canvas
```

Penting untuk file image/video besar.

---

# 102. MOBILE DESIGN

Mobile harus dirancang khusus.

Jangan hanya shrink desktop.

Gunakan:

```text
single column
sticky bottom action jika relevan
scrollable category pills
responsive preview
accordion options
sheet untuk settings panjang
```

---

# 103. MOBILE ACTION

Pada tool page:

```text
Process
```

atau:

```text
Download
```

boleh dibuat sticky bottom jika action utama sulit dijangkau.

---

# 104. MOBILE OVERFLOW

Tidak boleh ada:

```text
horizontal page overflow
```

Kecuali elemen yang memang:

```text
horizontal scroll category
```

---

# 105. COMPONENT LIBRARY

Buat komponen reusable:

```text
AppHeader
AppFooter

PageContainer

ToolSearch
CommandPalette

CategoryTabs

ToolGrid
ToolCard
ToolBadge

ToolPageHeader
ToolWorkspace

FileDropzone
FileList
FileListItem
FilePreview

ProcessingProgress
ProcessingStatus

ResultPanel
DownloadButton
BatchDownloadButton

FormatSelector
QualitySlider
DimensionInput

PrivacyBadge

RelatedTools

EmptyState
ErrorState
LoadingState

ConfirmDialog

ThemeToggle
```

---

# 106. COMPONENT RULES

Jangan membuat component generik sebelum benar-benar digunakan.

Hindari:

```text
over-abstraction
```

Tetapi hindari juga duplicate component.

---

# 107. BUTTON VARIANTS

Minimal:

```text
primary
secondary
outline
ghost
destructive
```

Gunakan shadcn Button sebagai base.

---

# 108. FORM CONTROLS

Standard:

```text
Input
Textarea
Select
Checkbox
RadioGroup
Slider
Switch
Tabs
```

Semua menggunakan design system yang sama.

---

# 109. PRIVACY BADGE

Tampilkan pada tool page.

Contoh client:

```text
Local Processing

Your file stays on this device.
```

Remote:

```text
Server Processing

This tool requires temporary server processing.
```

Jangan membuat klaim yang tidak sesuai implementation.

---

# 110. PROCESSING MODE ICON

Contoh:

```text
Local
Shield icon

Server
Cloud icon

AI
Sparkles icon
```

Tidak perlu memakai emoji.

---

# 111. IMAGE COMPRESSION IMPLEMENTATION

Untuk MVP frontend, implementasikan benar-benar:

```text
JPG
PNG
WebP
```

Support:

```text
single
multiple
quality setting
preview
before size
after size
saving percentage
download
```

Gunakan client-side processing.

---

# 112. IMAGE RESIZE IMPLEMENTATION

Implementasikan:

```text
width
height
aspect ratio lock
percentage
output format
quality
```

Gunakan Canvas/pica sesuai kebutuhan.

---

# 113. ROTATE / FLIP

Implementasikan client-side.

```text
90° left
90° right
180°
flip horizontal
flip vertical
```

---

# 114. WATERMARK

Support:

```text
text
image/logo
opacity
size
position
padding
rotation
```

Preset position:

```text
top-left
top-center
top-right

center-left
center
center-right

bottom-left
bottom-center
bottom-right
```

---

# 115. METADATA

Image metadata viewer:

```text
filename
size
type
dimensions
EXIF
camera
date
orientation
GPS if available
```

Jangan otomatis menampilkan GPS secara mencolok.

Metadata removal harus client-side jika memungkinkan.

---

# 116. JSON FORMATTER

Implementasikan penuh client-side.

Support:

```text
Format
Minify
Validate
Copy
Download
Clear
```

Error:

```text
line
column
message
```

jika parser dapat memberikan informasi tersebut.

---

# 117. BASE64 TOOL

Support:

```text
Text → Base64
Base64 → Text

File → Base64
```

Untuk file besar beri warning karena Base64 meningkatkan ukuran.

---

# 118. UUID

Support:

```text
UUID v4
```

Gunakan:

```ts
crypto.randomUUID()
```

jika tersedia.

Jangan menggunakan pseudo-random buatan sendiri.

---

# 119. PASSWORD GENERATOR

Gunakan:

```text
Web Crypto API
```

Options:

```text
length
uppercase
lowercase
numbers
symbols
exclude ambiguous
```

Jangan gunakan:

```ts
Math.random()
```

untuk password.

---

# 120. FRONTEND SECURITY BASELINE

Walaupun security backend akan dibahas terpisah, frontend minimal harus:

```text
never hardcode secrets
never expose private API keys
sanitize rendered HTML
avoid dangerouslySetInnerHTML
validate URL input
validate files
avoid storing sensitive data
use Web Crypto where needed
```

Jangan membuat secret environment variables dengan prefix:

```text
VITE_
```

karena variable tersebut terekspos ke browser.

---

# 121. HTML PREVIEW

Jika harus merender user HTML:

```text
sandboxed iframe
```

Jangan langsung:

```tsx
dangerouslySetInnerHTML
```

tanpa sanitization dan isolation.

---

# 122. URL INPUT

Untuk Website Screenshot frontend:

validate:

```text
http
https
```

Jangan menerima:

```text
javascript:
data:
file:
```

Backend akan menambahkan SSRF protection pada tahap security/backend.

---

# 123. CLIPBOARD

Gunakan Clipboard API hanya setelah user action.

Copy feedback:

```text
Copied
```

Gunakan toast ringan.

---

# 124. TOAST

Gunakan untuk:

```text
copy success
download ready
small errors
settings saved
```

Jangan gunakan toast untuk semua state.

---

# 125. MODALS

Gunakan modal hanya jika user perlu menyelesaikan tugas sementara.

Jangan menggunakan modal untuk seluruh tool.

Main interaction harus tetap di page.

---

# 126. LOCAL STORAGE WRAPPER

Jangan memanggil localStorage acak di seluruh component.

Buat abstraction:

```text
src/lib/storage/
```

Contoh:

```ts
getFavoriteTools()
saveFavoriteTools()

getRecentTools()
saveRecentTools()

getThemePreference()
```

---

# 127. BROWSER CAPABILITY

Buat utility:

```text
supportsOffscreenCanvas()
supportsWebWorkers()
supportsWebSpeech()
supportsMediaRecorder()
supportsClipboard()
```

UI harus degrade gracefully.

---

# 128. FEATURE SUPPORT

Jika browser tidak mendukung fitur:

```text
This feature is not supported by your browser.
```

Jangan crash.

---

# 129. TESTING

Gunakan:

```text
Vitest
React Testing Library
Playwright
```

---

# 130. UNIT TEST

Minimal test:

```text
tool registry
search
filter
file validation
format conversion
size formatter
saving calculator
storage helpers
processing states
```

---

# 131. COMPONENT TEST

Test:

```text
ToolCard
FileDropzone
ToolSearch
CategoryTabs
ResultPanel
```

---

# 132. E2E TEST

Playwright minimal:

```text
Homepage loads

Search tool

Filter category

Open Compress Image

Upload valid image

Compress image

Download result

Resize image

Generate QR

Format JSON

Switch dark mode
```

---

# 133. ERROR BOUNDARY

Gunakan error boundary pada level yang tepat.

Jangan membuat satu tool crash seluruh aplikasi.

---

# 134. LOADING BOUNDARY

Gunakan loading UI saat route/module berat diload.

Tetapi jangan menampilkan full-screen spinner untuk operasi ringan.

---

# 135. SKELETON

Gunakan skeleton hanya ketika content benar-benar asynchronous.

Homepage tool registry lokal tidak membutuhkan skeleton.

---

# 136. FOLDER NAMING

Gunakan:

```text
kebab-case
```

Contoh:

```text
compress-image
tool-registry
file-dropzone
```

React component:

```text
PascalCase
```

Function:

```text
camelCase
```

---

# 137. IMPORT RULES

Gunakan path aliases.

Contoh:

```ts
import { ToolCard } from "@/components/tool/ToolCard";
```

Jangan:

```ts
../../../../components
```

---

# 138. ENVIRONMENT

Buat:

```text
.env.example
```

Frontend only:

```env
VITE_APP_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:8000
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=
```

Ingat:

Semua variable `VITE_` bersifat public.

Jangan masukkan:

```text
database password
private API key
secret token
cloud secret
```

---

# 139. ANALYTICS FRONTEND

Siapkan event abstraction.

Contoh:

```ts
trackToolOpened()
trackProcessingStarted()
trackProcessingCompleted()
trackProcessingFailed()
```

Jangan panggil PostHog langsung dari semua component.

Gunakan satu analytics service.

---

# 140. ANALYTICS DATA

Boleh:

```text
tool name
category
processing mode
duration
size bucket
success/failure
```

Jangan kirim:

```text
filename
document content
QR payload
text input
JWT
private image
audio content
```

---

# 141. INTERNATIONALIZATION READY

Struktur frontend harus memungkinkan i18n di masa depan.

Jangan hardcode string secara acak pada business logic.

Tetapi MVP tidak perlu langsung memasang library i18n jika belum diperlukan.

Gunakan struktur yang memungkinkan:

```text
English
Indonesian
```

nantinya.

---

# 142. DOWNLOAD NAMING

Contoh:

```text
photo-compressed.jpg
photo-resized.webp
photo-cropped.png
photo-watermarked.jpg
photo-no-bg.png
```

Jangan download sebagai:

```text
7b20f454-3423-...
```

---

# 143. FORMATTER UTILITIES

Buat:

```ts
formatBytes()
formatDuration()
formatDimensions()
formatPercentage()
sanitizeFilename()
```

Jangan duplicate.

---

# 144. FILE SIZE

Gunakan format:

```text
1.4 KB
2.8 MB
1.1 GB
```

---

# 145. ORIGINAL FILE

Jangan mutate original browser File object.

Processing harus menghasilkan:

```text
Blob
File
```

baru.

---

# 146. RESET TOOL

Semua workspace harus mempunyai:

```text
Reset
```

Reset:

```text
files
settings
preview
results
errors
processing state
```

dan cleanup object URL.

---

# 147. REPROCESS

Setelah hasil keluar, user dapat:

```text
adjust setting
process again
```

tanpa upload ulang selama file masih berada dalam memory.

---

# 148. BEFORE / AFTER

Untuk:

```text
Remove Background
AI Upscale
Image Enhancement
Compression
```

gunakan visual comparison jika berguna.

---

# 149. DOWNLOAD BUTTON

Primary action result:

```text
Download
```

Harus jelas.

Jangan menyembunyikan tombol download dalam menu jika hanya ada satu result.

---

# 150. TOOL PAGE WIDTH

Tool workspace:

```text
max-width sekitar 1000–1200px
```

Tetapi related content/SEO section dapat memakai container penuh.

---

# 151. CONTENT DENSITY

Utility interface harus terasa:

```text
compact
clear
not cramped
```

Jangan menggunakan card di dalam card di dalam card.

---

# 152. DESIGN CONSISTENCY

Semua tool menggunakan:

```text
same header
same upload
same option panel
same progress
same result structure
same related tools
same privacy badge
```

Tool-specific UI hanya pada bagian workspace.

---

# 153. MVP IMPLEMENTATION ORDER

Kerjakan dalam urutan berikut.

## Phase 1 — Foundation

```text
TanStack Start setup
TypeScript
Tailwind
shadcn/ui
design tokens
theme
routing
layout
tool registry
```

## Phase 2 — Discovery

```text
Homepage
Tool Grid
Tool Cards
Categories
Search
Command Palette
Popular Tools
Recent Tools
Favorites
```

## Phase 3 — Generic Tool Infrastructure

```text
Tool Page template
FileDropzone
FileList
Preview
Processing abstraction
Progress
Result
Errors
Download
```

## Phase 4 — Client Image Tools

```text
Compress Image
Resize Image
Crop Image
Rotate
Flip
Convert Image
Watermark
Metadata
```

## Phase 5 — QR + Developer

```text
QR Generator
QR Reader
Barcode

JSON Formatter
Base64
UUID
Password Generator
Hash
```

## Phase 6 — Backend-dependent UI

Buat UI + adapter contract untuk:

```text
Remove Background
Upscale Image
OCR
Speech to Text
Video Processing
```

Jangan fake implementasi backend.

---

# 154. INITIAL TOOLS TO FULLY IMPLEMENT

Frontend pertama wajib benar-benar bekerja:

```text
Compress Image
Resize Image
Rotate Image
Flip Image
Image Converter
Watermark Image

QR Code Generator

JSON Formatter
Base64 Encoder/Decoder
UUID Generator
Password Generator
```

---

# 155. BACKEND-DEPENDENT FEATURES

Untuk tool yang belum memiliki backend:

tampilkan UI lengkap tetapi jangan berpura-pura proses berhasil.

Gunakan development state:

```text
Backend service not configured
```

atau feature flag.

Jangan menghasilkan dummy result kepada end user.

---

# 156. FEATURE FLAGS

Buat:

```ts
export const features = {
  backgroundRemoval: false,
  imageUpscale: false,
  speechToText: false,
  videoProcessing: false,
};
```

Frontend dapat mengaktifkan setelah backend tersedia.

---

# 157. UI UNTUK DISABLED FEATURE

Jika belum aktif:

```text
Coming Soon
```

atau sembunyikan dari production registry sampai benar-benar siap.

Jangan menampilkan tombol yang tidak berfungsi.

---

# 158. CODE QUALITY

Wajib:

```text
small focused components
typed props
clear function names
minimal side effects
proper cleanup
consistent error handling
no dead code
no unused dependency
```

---

# 159. REACT RULES

Hindari `useEffect` jika data dapat dihitung secara langsung.

Jangan:

```ts
useEffect(() => {
  setFilteredTools(
    tools.filter(...)
  );
}, [tools, query]);
```

Gunakan:

```ts
const filteredTools = useMemo(
  () => tools.filter(...),
  [tools, query]
);
```

atau perhitungan langsung jika murah.

---

# 160. PERFORMANCE RULE

Jangan menggunakan `useMemo` pada semua hal.

Gunakan hanya ketika:

```text
computation expensive
referential stability memang penting
```

---

# 161. FILE PROCESSING RULE

Jangan:

```text
Base64 seluruh gambar besar
```

untuk preview.

Gunakan:

```text
Blob URL
```

---

# 162. NO PLACEHOLDER FUNCTIONALITY

Jangan membuat:

```text
Compress button
```

yang hanya:

```ts
setTimeout(...)
```

dan menghasilkan file asli.

Jika belum bisa dikerjakan:

```text
disable feature
```

---

# 163. NO UNNECESSARY BACKEND

Jika tool dapat dilakukan aman dan efisien di browser:

```text
jangan kirim ke backend
```

Contoh:

```text
QR
JSON
UUID
Base64 text
basic image resize
crop
rotation
watermark
```

---

# 164. PRIVACY-FIRST UX

Untuk local processing tampilkan:

```text
Processed locally

Your file never leaves this device.
```

Ini menjadi selling point utama.

---

# 165. NO ACCOUNT WALL

Homepage dan basic tools tidak meminta:

```text
Sign in
Create account
Email
```

sebelum user dapat mencoba.

---

# 166. FINAL UI QUALITY

Hasil tidak boleh terlihat seperti:

```text
admin dashboard
template marketplace
school project
generic Tailwind demo
```

Harus terlihat seperti polished utility SaaS.

---

# 167. IMPLEMENTATION WORKFLOW FOR CODING AGENT

Saat mulai:

1. Inspect repository.
2. Jangan overwrite project yang sudah valid.
3. Audit dependencies.
4. Pastikan package manager `pnpm`.
5. Setup TypeScript strict.
6. Setup TanStack Start.
7. Setup Tailwind.
8. Setup shadcn/ui.
9. Setup design tokens.
10. Buat app shell.
11. Buat Tool Registry.
12. Buat homepage.
13. Buat search/filter.
14. Buat Tool Card.
15. Buat generic Tool Page.
16. Buat FileDropzone.
17. Buat processing abstraction.
18. Implement Compress Image.
19. Implement Resize Image.
20. Implement Image Converter.
21. Implement QR Generator.
22. Implement JSON Formatter.
23. Tambahkan tests.
24. Jalankan lint.
25. Jalankan typecheck.
26. Jalankan unit tests.
27. Jalankan Playwright.
28. Jalankan production build.
29. Perbaiki seluruh error.
30. Jangan menyatakan selesai sebelum build dan test berhasil.

---

# 168. VALIDATION COMMAND

Sebelum menyelesaikan setiap phase jalankan:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Setelah critical user flow:

```bash
pnpm test:e2e
```

---

# 169. ACCEPTANCE CRITERIA — FRONTEND

Frontend dianggap memenuhi requirement jika:

```text
1. TanStack Start berjalan.
2. pnpm digunakan.
3. TypeScript strict aktif.
4. Homepage responsive.
5. Tool cards berasal dari Tool Registry.
6. Category filtering berfungsi.
7. Search berfungsi.
8. Command Palette berfungsi.
9. Dark mode berfungsi.
10. Tool routes berfungsi.
11. FileDropzone reusable.
12. File validation berjalan.
13. Compress Image benar-benar berjalan.
14. Resize Image benar-benar berjalan.
15. Image Converter benar-benar berjalan.
16. QR Generator benar-benar berjalan.
17. JSON Formatter benar-benar berjalan.
18. Download result bekerja.
19. Processing state konsisten.
20. Error state tersedia.
21. Object URL di-cleanup.
22. Heavy dependency lazy-loaded.
23. Mobile layout tidak overflow.
24. Keyboard navigation bekerja.
25. Lighthouse target diperhatikan.
26. Lint clean.
27. Typecheck clean.
28. Tests pass.
29. Production build berhasil.
```

---

# 170. FINAL FRONTEND STACK

Gunakan keputusan final berikut:

```text
FRAMEWORK
TanStack Start

UI
React

LANGUAGE
TypeScript

BUILD
Vite

PACKAGE MANAGER
pnpm

CSS
Tailwind CSS

COMPONENT SYSTEM
shadcn/ui
Radix UI

ICONS
Lucide React

ROUTING
TanStack Router

SERVER STATE
TanStack Query

FORMS
TanStack Form

VALIDATION
Zod

SEARCH
Fuse.js

CLIENT PROCESSING
Canvas API
OffscreenCanvas
Web Worker
WebAssembly
File API
Blob API
Web Audio API
MediaRecorder

IMAGE
browser-image-compression
pica
exifr

TESTING
Vitest
React Testing Library
Playwright

QUALITY
ESLint
Prettier
TypeScript strict
```

---

# 171. FINAL DESIGN SYSTEM

Gunakan:

```text
Visual:
Clean modern utility SaaS

Background:
Soft off-white / lavender

Cards:
White

Border:
Thin neutral

Radius:
16px

Typography:
Inter

Primary text:
Dark charcoal

Category accent:
Pastel

Navigation:
Pill filters

Tool layout:
Large responsive card grid

Desktop:
5 columns pada viewport besar

Mobile:
1 column

Shadow:
Minimal

Animation:
Subtle

Main focus:
Tool discovery + fast processing
```

---

# 172. CORE PRINCIPLE

Seluruh frontend harus mengikuti prinsip:

```text
Simple UI
+
Fast Client Processing
+
Modular Tool Architecture
+
Strong Type Safety
+
Reusable Components
+
Privacy-First Processing
+
Excellent Mobile UX
+
Minimal Dependencies
```

Jangan membangun frontend sebagai kumpulan halaman terpisah.

Bangun sebagai **platform utility modular** dengan satu design system, satu Tool Registry, satu processing abstraction, dan reusable infrastructure yang memungkinkan penambahan puluhan atau ratusan tool tanpa mengubah fondasi aplikasi.
