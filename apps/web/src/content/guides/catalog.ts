import type { Locale } from '@/i18n/config'
import type { ToolCategory } from '@/features/tools/tool-registry'
import { absoluteUrl } from '@/features/seo/site'
export interface GuideCopy {
  title: string
  description: string
  intro: string
  sections: readonly { heading: string; paragraphs: readonly string[] }[]
}

export interface GuideArticle {
  slug: string
  category: ToolCategory
  toolSlugs: readonly string[]
  en: GuideCopy
  id: GuideCopy
}

function copy(locale: Locale, article: GuideArticle): GuideCopy {
  return locale === 'id' ? article.id : article.en
}

export const guideArticles: readonly GuideArticle[] = [
  {
    slug: 'how-to-compress-images-online',
    category: 'image',
    toolSlugs: ['compress-image', 'resize-image', 'png-to-jpg'],
    en: {
      title: 'How to compress images online',
      description: 'Reduce JPEG, PNG, and WebP file size in the browser without installing an editor.',
      intro: 'Image compression is usually a size problem, not a design problem. A product photo that looks sharp at 2400px can still be several megabytes because the encoder kept more detail than the screen will ever show. Kits Compress Image runs in your browser: the file is not uploaded unless you later open a server tool.',
      sections: [
        {
          heading: 'Pick the format that can actually shrink',
          paragraphs: [
            'JPEG and WebP are lossy. They throw away color detail that is hard to see, which is why a photograph often drops 40–80% with little visible change. PNG is lossless. Compress Image still has Lossless, Balanced, and Strong modes for PNG, but a photographic PNG often shrinks more if you convert it to JPEG or WebP first.',
            'Keep PNG when you need a sharp logo, UI screenshot, or transparency. Keep JPEG or WebP for photos, gradients, and anything with camera noise.',
          ],
        },
        {
          heading: 'Compress before you upload elsewhere',
          paragraphs: [
            'Open Compress Image, drop the file, and process it. You get a before/after size and a download named from the original. If the preview looks muddy, you asked the encoder for too much. Use a milder PNG mode or leave JPEG quality higher.',
            'If the file is still large after a good encode, the pixel count is the leftover cost. A 4000px image served at 800px is wasted data. Resize Image first, then compress.',
          ],
        },
        {
          heading: 'What “good enough” looks like',
          paragraphs: [
            'For a website hero, start around 1600px on the long edge and a compressed JPEG/WebP under 300 KB if the scene is simple. For a thumbnail, 400–800px is plenty. For print or archive, skip this workflow.',
            'Kits does not invent a quality percentage for PNG. If Balanced still looks wrong, use Lossless and accept a larger file, or convert the photo to WebP.',
          ],
        },
      ],
    },
    id: {
      title: 'Cara kompres gambar online',
      description: 'Perkecil ukuran file JPEG, PNG, dan WebP di browser tanpa memasang editor.',
      intro: 'Kompresi gambar biasanya soal ukuran, bukan desain. Foto produk yang tajam di 2400px bisa tetap beberapa megabyte karena encoder menyimpan detail yang layar tidak akan tampilkan. Kompres Gambar di Kits berjalan di browser: file tidak diunggah kecuali Anda membuka tool server.',
      sections: [
        {
          heading: 'Pilih format yang memang bisa mengecil',
          paragraphs: [
            'JPEG dan WebP bersifat lossy. Detail warna yang sulit dilihat dibuang, jadi foto sering turun 40–80% tanpa perubahan yang kentara. PNG bersifat lossless. Kompres Gambar punya mode Lossless, Balanced, dan Strong untuk PNG, tetapi PNG fotografis biasanya lebih kecil jika dikonversi ke JPEG atau WebP dulu.',
            'Pertahankan PNG untuk logo tajam, tangkapan UI, atau transparansi. Pakai JPEG atau WebP untuk foto, gradasi, dan noise kamera.',
          ],
        },
        {
          heading: 'Kompres sebelum mengunggah ke tempat lain',
          paragraphs: [
            'Buka Kompres Gambar, jatuhkan file, lalu proses. Anda mendapat perbandingan ukuran dan unduhan dari nama asli. Jika pratinjau pecah, encoder diminta terlalu agresif. Pakai mode PNG yang lebih ringan atau biarkan kualitas JPEG lebih tinggi.',
            'Jika file masih besar setelah encode yang wajar, jumlah piksel yang tersisa. Gambar 4000px yang ditampilkan 800px adalah data terbuang. Ubah ukuran dulu, baru kompres.',
          ],
        },
        {
          heading: 'Seperti apa hasil yang cukup baik',
          paragraphs: [
            'Untuk hero situs, mulai sekitar 1600px di sisi panjang dan JPEG/WebP terkompresi di bawah 300 KB jika adegannya sederhana. Thumbnail cukup 400–800px. Untuk cetak atau arsip, lewati alur ini.',
            'Kits tidak membuat persentase kualitas untuk PNG. Jika Balanced masih terlihat salah, pakai Lossless dan terima file lebih besar, atau konversi foto ke WebP.',
          ],
        },
      ],
    },
  },
  {
    slug: 'how-to-remove-background-from-an-image',
    category: 'image',
    toolSlugs: ['remove-background', 'basic-background-removal', 'png-to-jpg'],
    en: {
      title: 'How to remove a background from an image',
      description: 'Cut a subject out of a photo and export a transparent PNG, with a clear split between local and server tools.',
      intro: 'Background removal is two different jobs. A high-contrast product on white can be keyed locally. Hair, glass, and busy rooms need a model. Kits labels that split before you start: Basic Background Removal stays in the browser; Remove Background uses the Kits server when the tool is available.',
      sections: [
        {
          heading: 'When a local cutout is enough',
          paragraphs: [
            'If the subject sits on a flat studio backdrop, start with Basic Background Removal. You stay on-device, which is the right default for a passport-style headshot or a pack shot you do not want uploaded.',
            'Zoom the preview. Jagged edges around hair or a halo around a bottle mean the local key ran out of contrast. Do not keep clicking. Switch tools.',
          ],
        },
        {
          heading: 'When the server tool is the honest choice',
          paragraphs: [
            'Remove Background uploads the image for a job, then returns a cutout. That is a server tool. Use it when the background is a kitchen, a street, or anything the local key will chew into the subject.',
            'Export PNG if you need transparency. JPEG cannot store alpha; converting a cutout to JPG will fill the empty pixels with a solid color and undo the work.',
          ],
        },
        {
          heading: 'After the cutout',
          paragraphs: [
            'Check the edges at 100%. If a hand is missing, the model guessed the wrong silhouette. Try a tighter crop around the subject and run it again.',
            'A cutout is not a new photo. Lighting still belongs to the original scene. If you drop it on a different backdrop, the color temperature may look wrong. That is expected, not a Kits defect.',
          ],
        },
      ],
    },
    id: {
      title: 'Cara menghapus latar belakang gambar',
      description: 'Potong subjek dari foto dan ekspor PNG transparan, dengan pemisahan jelas antara tool lokal dan server.',
      intro: 'Hapus latar adalah dua pekerjaan berbeda. Produk kontras tinggi di atas putih bisa dikunci secara lokal. Rambut, kaca, dan ruangan ramai butuh model. Kits menandai pemisahan itu sebelum Anda mulai: Hapus Latar Dasar tetap di browser; Hapus Latar memakai server Kits jika tool tersedia.',
      sections: [
        {
          heading: 'Kapan potongan lokal cukup',
          paragraphs: [
            'Jika subjek di backdrop studio datar, mulai dari Hapus Latar Dasar. File tetap di perangkat, default yang tepat untuk foto paspor atau produk yang tidak ingin diunggah.',
            'Perbesar pratinjau. Tepi bergerigi di rambut atau halo di botol berarti kunci lokal kehabisan kontras. Jangan terus diklik. Ganti tool.',
          ],
        },
        {
          heading: 'Kapan tool server adalah pilihan jujur',
          paragraphs: [
            'Hapus Latar mengunggah gambar untuk job, lalu mengembalikan potongan. Itu tool server. Pakai jika latarnya dapur, jalan, atau apa pun yang akan dimakan kunci lokal ke dalam subjek.',
            'Ekspor PNG jika butuh transparansi. JPEG tidak menyimpan alpha; konversi potongan ke JPG mengisi piksel kosong dengan warna solid dan membatalkan kerja itu.',
          ],
        },
        {
          heading: 'Setelah potongan',
          paragraphs: [
            'Cek tepi di 100%. Jika tangan hilang, model salah menebak siluet. Crop lebih rapat di sekitar subjek, lalu jalankan lagi.',
            'Potongan bukan foto baru. Pencahayaan masih milik adegan asli. Jika diletakkan di latar lain, suhu warna bisa terasa salah. Itu wajar, bukan cacat Kits.',
          ],
        },
      ],
    },
  },
  {
    slug: 'png-vs-jpg-which-format-should-you-use',
    category: 'image',
    toolSlugs: ['image-converter', 'png-to-jpg', 'jpg-to-png', 'png-to-webp'],
    en: {
      title: 'PNG vs JPG: which format should you use?',
      description: 'A practical rule for photos, graphics, and transparency — then convert only when the destination needs it.',
      intro: 'PNG and JPEG solve different constraints. Treating them as interchangeable “image files” is how logos get muddy and photos stay huge. Use Image Converter when you already know the destination; do not convert just to convert.',
      sections: [
        {
          heading: 'JPEG is for continuous tone',
          paragraphs: [
            'Photographs, gradients, and anything with noise belong in JPEG (or WebP). The format is allowed to discard information. That is the point. A 12 MP phone photo as PNG is usually a storage accident.',
            'JPEG has no alpha channel. A transparent graphic saved as JPG will grow a background. If you see white corners on a logo, someone flattened it.',
          ],
        },
        {
          heading: 'PNG is for edges and alpha',
          paragraphs: [
            'Screenshots, icons, type, and cutouts need PNG or WebP with alpha. Lossless PNG keeps every pixel, which is why a UI screenshot stays readable after many saves and a JPEG screenshot does not.',
            'PNG-to-JPG is a one-way trip for transparency. Convert that way only when the destination (email, a CMS that rejects PNG, a print shop) cannot take PNG.',
          ],
        },
        {
          heading: 'WebP as a third option',
          paragraphs: [
            'WebP can be lossy like JPEG or keep alpha like PNG. It is the better default for modern websites if every browser you support can decode it. If a partner still requires JPG, convert at the end, not at the start of editing.',
            'Kits converters run in the browser for these image formats. You can compare PNG, JPG, and WebP of the same source without creating an account.',
          ],
        },
      ],
    },
    id: {
      title: 'PNG vs JPG: format mana yang harus dipakai?',
      description: 'Aturan praktis untuk foto, grafis, dan transparansi — konversi hanya jika tujuan membutuhkannya.',
      intro: 'PNG dan JPEG menyelesaikan batasan berbeda. Memperlakukan keduanya sebagai “file gambar” yang sama membuat logo pecah dan foto tetap besar. Pakai Konverter Gambar jika tujuan sudah jelas; jangan konversi hanya untuk konversi.',
      sections: [
        {
          heading: 'JPEG untuk nada kontinyu',
          paragraphs: [
            'Foto, gradasi, dan apa pun yang ber-noise masuk JPEG (atau WebP). Format ini boleh membuang informasi. Itu tujuannya. Foto HP 12 MP sebagai PNG biasanya kecelakaan penyimpanan.',
            'JPEG tidak punya kanal alpha. Grafis transparan yang disimpan JPG akan mendapat latar. Jika logo punya sudut putih, seseorang meratakannya.',
          ],
        },
        {
          heading: 'PNG untuk tepi dan alpha',
          paragraphs: [
            'Screenshot, ikon, teks, dan potongan butuh PNG atau WebP dengan alpha. PNG lossless menjaga setiap piksel, jadi tangkapan UI tetap terbaca setelah banyak simpan, sementara JPEG tidak.',
            'PNG ke JPG adalah jalan satu arah untuk transparansi. Lakukan hanya jika tujuan (email, CMS yang menolak PNG, percetakan) tidak menerima PNG.',
          ],
        },
        {
          heading: 'WebP sebagai opsi ketiga',
          paragraphs: [
            'WebP bisa lossy seperti JPEG atau menyimpan alpha seperti PNG. Itu default yang lebih baik untuk situs modern jika semua browser yang Anda dukung bisa mendekodenya. Jika mitra masih menuntut JPG, konversi di akhir, bukan di awal suntingan.',
            'Konverter Kits untuk format ini berjalan di browser. Anda bisa membandingkan PNG, JPG, dan WebP dari sumber yang sama tanpa akun.',
          ],
        },
      ],
    },
  },
  {
    slug: 'how-to-convert-pdf-to-png',
    category: 'pdf',
    toolSlugs: ['pdf-to-png', 'pdf-to-jpg', 'png-to-pdf'],
    en: {
      title: 'How to convert PDF to PNG',
      description: 'Turn PDF pages into PNG images when you need a preview, a slide, or a graphic — not an editable document.',
      intro: 'A PDF page is a box of vectors, fonts, and sometimes images. A PNG is a grid of pixels. PDF to PNG is a snapshot, not a round-trip. Kits runs this on the server because rasterizing pages needs a PDF engine. The file is uploaded for that job, then you download the images.',
      sections: [
        {
          heading: 'Use PNG when the page has type or UI',
          paragraphs: [
            'PNG keeps hard edges. If the PDF is a diagram, a screenshot-heavy one-pager, or a page with small type, PNG (or PDF to JPG for a photo-heavy page) is the right export. Do not expect to recover the original fonts after this.',
            'If you only need to send a preview in chat, one PNG per page is easier than asking someone to open a PDF on a phone.',
          ],
        },
        {
          heading: 'Limits that actually matter',
          paragraphs: [
            'Remote Kits workspaces cap uploads at 100 MB per file. A scanned 300-page binder may miss that cap even if it “is just a PDF.” Split the document first, or export a page range with Extract PDF Pages if you only need a few sheets.',
            'Raster size follows the page. A large poster PDF becomes a large PNG. If the result is huge, you wanted a preview, not a print plate — compress or resize the PNG after download.',
          ],
        },
        {
          heading: 'Going the other way',
          paragraphs: [
            'PNG to PDF wraps images into a document. That is useful for a photo set you want to email as one file. It does not reconstruct a text PDF. If you started from a designed layout, keep the original PDF.',
          ],
        },
      ],
    },
    id: {
      title: 'Cara konversi PDF ke PNG',
      description: 'Ubah halaman PDF menjadi gambar PNG untuk pratinjau, slide, atau grafis — bukan dokumen yang bisa disunting.',
      intro: 'Halaman PDF adalah kotak vektor, font, dan kadang gambar. PNG adalah kisi piksel. PDF ke PNG adalah snapshot, bukan pulang-pergi. Kits menjalankannya di server karena raster halaman butuh mesin PDF. File diunggah untuk job itu, lalu Anda mengunduh gambar.',
      sections: [
        {
          heading: 'Pakai PNG jika halaman berisi teks atau UI',
          paragraphs: [
            'PNG menjaga tepi tajam. Jika PDF-nya diagram, one-pager penuh screenshot, atau halaman dengan teks kecil, PNG (atau PDF ke JPG untuk halaman penuh foto) adalah ekspor yang tepat. Jangan berharap font asli kembali setelah ini.',
            'Jika Anda hanya perlu pratinjau di chat, satu PNG per halaman lebih mudah daripada meminta orang membuka PDF di HP.',
          ],
        },
        {
          heading: 'Batas yang benar-benar penting',
          paragraphs: [
            'Workspace remote Kits membatasi unggahan 100 MB per file. Binder pindaian 300 halaman bisa melebihi itu meski “hanya PDF.” Pecah dokumen dulu, atau ekspor rentang halaman dengan Ekstrak Halaman PDF jika hanya butuh beberapa lembar.',
            'Ukuran raster mengikuti halaman. PDF poster besar menjadi PNG besar. Jika hasilnya raksasa, Anda butuh pratinjau, bukan pelat cetak — kompres atau ubah ukuran PNG setelah unduh.',
          ],
        },
        {
          heading: 'Arah sebaliknya',
          paragraphs: [
            'PNG ke PDF membungkus gambar menjadi dokumen. Berguna untuk set foto yang ingin dikirim sebagai satu file. Itu tidak merekonstruksi PDF teks. Jika Anda mulai dari layout desain, simpan PDF aslinya.',
          ],
        },
      ],
    },
  },
  {
    slug: 'how-to-reduce-image-file-size',
    category: 'image',
    toolSlugs: ['compress-image', 'resize-image', 'image-converter'],
    en: {
      title: 'How to reduce image file size',
      description: 'A three-step order that actually shrinks photos: resize, choose a format, then compress.',
      intro: 'People open a compressor first and then wonder why a 5000px PNG barely moved. File size is pixels × format × encoder. Do those in order or you fight the same bytes twice.',
      sections: [
        {
          heading: '1. Resize to the size you will show',
          paragraphs: [
            'If the image will sit in a 720px column, exporting 4000px only helps a retina screen up to about 1440–1600px. Anything past that is weight. Resize Image in Kits is local. Set the long edge, keep aspect ratio unless you intend to crop.',
          ],
        },
        {
          heading: '2. Stop using PNG for photographs',
          paragraphs: [
            'A camera JPEG re-saved as PNG often gets larger. Convert photos to JPEG or WebP, keep PNG for graphics. Image Converter does that in the browser.',
          ],
        },
        {
          heading: '3. Compress last',
          paragraphs: [
            'Now open Compress Image. The encoder has fewer pixels to spend bits on, so the same visual quality costs less. Compare the preview at 100%, not at thumbnail size — blur hides there.',
            'If you already compressed and the file is still too big for email, you missed step 1. Compressing a giant canvas cannot invent a small canvas.',
          ],
        },
      ],
    },
    id: {
      title: 'Cara mengurangi ukuran file gambar',
      description: 'Urutan tiga langkah yang benar-benar mengecilkan foto: ubah ukuran, pilih format, lalu kompres.',
      intro: 'Orang membuka kompresor dulu lalu heran PNG 5000px hampir tidak bergerak. Ukuran file adalah piksel × format × encoder. Kerjakan berurutan atau Anda melawan byte yang sama dua kali.',
      sections: [
        {
          heading: '1. Ubah ke ukuran yang akan ditampilkan',
          paragraphs: [
            'Jika gambar akan duduk di kolom 720px, ekspor 4000px hanya membantu layar retina sampai sekitar 1440–1600px. Lebih dari itu beban. Ubah Ukuran Gambar di Kits bersifat lokal. Set sisi panjang, jaga rasio kecuali Anda memang ingin crop.',
          ],
        },
        {
          heading: '2. Berhenti memakai PNG untuk foto',
          paragraphs: [
            'JPEG kamera yang disimpan ulang sebagai PNG sering justru lebih besar. Konversi foto ke JPEG atau WebP, simpan PNG untuk grafis. Konverter Gambar melakukan itu di browser.',
          ],
        },
        {
          heading: '3. Kompres di akhir',
          paragraphs: [
            'Baru buka Kompres Gambar. Encoder punya lebih sedikit piksel untuk dihabiskan, jadi kualitas visual yang sama lebih murah. Bandingkan pratinjau di 100%, bukan thumbnail — blur tersembunyi di sana.',
            'Jika sudah kompres dan file masih terlalu besar untuk email, langkah 1 terlewat. Mengompres kanvas raksasa tidak bisa menciptakan kanvas kecil.',
          ],
        },
      ],
    },
  },
  {
    slug: 'how-to-generate-a-qr-code',
    category: 'qr',
    toolSlugs: ['qr-code-generator', 'url-qr-code', 'wifi-qr-code'],
    en: {
      title: 'How to generate a QR code',
      description: 'Encode a URL, Wi-Fi network, or short text so a phone camera can open it without typing.',
      intro: 'A QR code is a payload, not a poster. If the payload is wrong, a beautiful mark still sends people to the wrong place. Kits QR tools run in the browser. Nothing you type is uploaded for generation.',
      sections: [
        {
          heading: 'Put the real destination in the code',
          paragraphs: [
            'For a link, use the final HTTPS URL, not a homepage you plan to redirect later. Print is sticky. If you must change the destination, encode a short URL you control.',
            'Open QR Code Generator or URL QR Code, paste the value, and download PNG. Test with your phone camera before you send the file to print.',
          ],
        },
        {
          heading: 'Wi-Fi and other structured payloads',
          paragraphs: [
            'Wi-Fi QR codes use a specific string (`WIFI:T:...`). Typing that by hand is how people ship a code that looks valid and fails in the camera. Use Wi-Fi QR Code and fill SSID, security type, and password in the fields.',
            'Keep the payload short. Dense codes with a paragraph of text need more modules and fail at small print sizes. A URL or a Wi-Fi blob is the right scale for a sticker.',
          ],
        },
        {
          heading: 'Print size',
          paragraphs: [
            'As a rule, the quiet zone (white margin) matters as much as the modules. Do not crop the PNG flush. On a poster, a code under ~2 cm on the short side is optimistic for cheap cameras.',
          ],
        },
      ],
    },
    id: {
      title: 'Cara membuat kode QR',
      description: 'Encode URL, jaringan Wi-Fi, atau teks pendek agar kamera HP bisa membukanya tanpa mengetik.',
      intro: 'Kode QR adalah payload, bukan poster. Jika payload salah, tanda yang indah tetap mengirim orang ke tempat yang salah. Tool QR Kits berjalan di browser. Yang Anda ketik tidak diunggah untuk generate.',
      sections: [
        {
          heading: 'Masukkan tujuan yang sebenarnya',
          paragraphs: [
            'Untuk tautan, pakai URL HTTPS final, bukan beranda yang nanti akan di-redirect. Cetakan lengket. Jika tujuan harus bisa berubah, encode URL pendek yang Anda kontrol.',
            'Buka Pembuat Kode QR atau QR URL, tempel nilai, unduh PNG. Tes dengan kamera HP sebelum file dikirim ke percetakan.',
          ],
        },
        {
          heading: 'Wi-Fi dan payload terstruktur lain',
          paragraphs: [
            'QR Wi-Fi memakai string khusus (`WIFI:T:...`). Mengetiknya manual adalah cara orang mengirim kode yang kelihatan valid lalu gagal di kamera. Pakai QR Wi-Fi dan isi SSID, jenis keamanan, dan kata sandi di field.',
            'Jaga payload tetap pendek. Kode padat berisi paragraf butuh lebih banyak modul dan gagal di ukuran cetak kecil. URL atau blob Wi-Fi adalah skala yang tepat untuk stiker.',
          ],
        },
        {
          heading: 'Ukuran cetak',
          paragraphs: [
            'Sebagai aturan, quiet zone (pinggiran putih) sama pentingnya dengan modul. Jangan crop PNG mepet. Di poster, kode di bawah ~2 cm di sisi pendek terlalu optimis untuk kamera murah.',
          ],
        },
      ],
    },
  },
  {
    slug: 'speech-to-text-guide',
    category: 'audio',
    toolSlugs: ['speech-to-text', 'noise-reduction', 'extract-audio-from-video'],
    en: {
      title: 'Speech to text guide',
      description: 'Turn a recording into editable text on the Kits server, and know what the model cannot fix.',
      intro: 'Speech to Text is a server tool. The audio is uploaded, a job runs, and you get a transcript. It will not invent a clean transcript from a loud café or a 3% volume phone recording. Treat the recording as the input you would give a human typist.',
      sections: [
        {
          heading: 'Give it speech, not a whole movie',
          paragraphs: [
            'If the source is a video, extract the audio first with Extract Audio from Video, then send that file. You stay under the 100 MB upload cap more easily, and the model is not spending time on a silent video stream.',
            'Mono voice at 16–48 kHz is enough. A huge 24-bit WAV of a two-hour meeting may hit the size cap before it hits a duration cap.',
          ],
        },
        {
          heading: 'Noise is not a prompt you can write away',
          paragraphs: [
            'Fan hum, cross-talk, and music under speech survive into the transcript as wrong words, not as a “noise” label. If the file is salvageable, run Noise Reduction first, then transcribe. If two people talk over each other, expect a mess.',
            'This tool does not diarize speakers unless the workspace says it does. Do not assume “Speaker 1” labels.',
          ],
        },
        {
          heading: 'After you have text',
          paragraphs: [
            'Read the first minute against the audio. If names and numbers are wrong, they will be wrong throughout. Fix the glossary yourself; do not re-run hoping for magic.',
            'Speech to Text is Pro when the catalog marks it Pro. Activate a license on the License page before you upload a long file just to hit a paywall.',
          ],
        },
      ],
    },
    id: {
      title: 'Panduan speech to text',
      description: 'Ubah rekaman menjadi teks yang bisa disunting di server Kits, dan ketahui apa yang tidak bisa diperbaiki model.',
      intro: 'Speech to Text adalah tool server. Audio diunggah, job berjalan, Anda mendapat transkrip. Itu tidak akan menciptakan transkrip bersih dari kafe ramai atau rekaman HP 3% volume. Perlakukan rekaman sebagai input yang akan Anda beri ke pengetik manusia.',
      sections: [
        {
          heading: 'Beri ucapan, bukan film utuh',
          paragraphs: [
            'Jika sumbernya video, ekstrak audio dulu dengan Ekstrak Audio dari Video, lalu kirim file itu. Anda lebih mudah di bawah batas unggah 100 MB, dan model tidak membuang waktu pada stream video diam.',
            'Suara mono 16–48 kHz sudah cukup. WAV 24-bit raksasa dari rapat dua jam bisa menabrak batas ukuran sebelum batas durasi.',
          ],
        },
        {
          heading: 'Noise bukan prompt yang bisa ditulis hilang',
          paragraphs: [
            'Dengung kipas, overlapping, dan musik di bawah bicara masuk ke transkrip sebagai kata salah, bukan label “noise”. Jika file masih bisa diselamatkan, jalankan Reduksi Noise dulu, baru transkripsi. Jika dua orang bicara bersamaan, harapkan berantakan.',
            'Tool ini tidak memisahkan pembicara kecuali workspace mengatakannya. Jangan asumsi ada label “Pembicara 1”.',
          ],
        },
        {
          heading: 'Setelah teks ada',
          paragraphs: [
            'Dengar menit pertama sambil membaca. Jika nama dan angka salah, itu akan salah sampai akhir. Perbaiki glosarium sendiri; jangan jalankan ulang berharap keajaiban.',
            'Speech to Text bersifat Pro jika katalog menandainya Pro. Aktifkan lisensi di halaman Lisensi sebelum mengunggah file panjang hanya untuk menabrak paywall.',
          ],
        },
      ],
    },
  },
  {
    slug: 'how-to-add-subtitles-to-video',
    category: 'video',
    toolSlugs: ['add-subtitle', 'extract-audio-from-video', 'speech-to-text'],
    en: {
      title: 'How to add subtitles to a video',
      description: 'Burn or mux an existing .srt, .vtt, or .ass file into a video on the Kits server.',
      intro: 'Add Subtitle does not write captions from a blank page. It takes a video and a subtitle file you already have, then burns or muxes that file on the Kits server. If you do not have timings, transcribe first and export a subtitle file from your editor; this tool will not invent cues from raw text.',
      sections: [
        {
          heading: 'Get the timings right before you upload',
          paragraphs: [
            'Open the .srt or .vtt in a text editor and confirm the first cue matches the first spoken line. A file that is 1.5 seconds late will look “broken” after burn-in even though the job succeeded.',
            'Use the same language and reading speed you would put on television. Two lines, ~42 characters, is a working default. A paragraph per cue will overflow the frame.',
          ],
        },
        {
          heading: 'Burn-in vs a separate caption file',
          paragraphs: [
            'Burning paints pixels into the picture. Every player will show them; nobody can turn them off. Muxing keeps a caption track when the container and player support it. If you need accessibility that users can disable, prefer a separate track in your NLE. Kits Add Subtitle is the burn/mux job for a file you already timed.',
            'Uploads are capped at 100 MB. A long 4K timeline may need a smaller proxy encode before this step.',
          ],
        },
        {
          heading: 'If you still need a transcript',
          paragraphs: [
            'Extract Audio from Video, run Speech to Text, then build the .srt in a caption tool. Only then come back to Add Subtitle. Skipping the timing step is the usual reason people think “auto subtitles failed.”',
          ],
        },
      ],
    },
    id: {
      title: 'Cara menambah subtitle ke video',
      description: 'Bakar atau mux file .srt, .vtt, atau .ass yang sudah ada ke video di server Kits.',
      intro: 'Tambah Subtitle tidak menulis caption dari halaman kosong. Ia mengambil video dan file subtitle yang sudah Anda punya, lalu membakar atau memux file itu di server Kits. Jika belum ada timing, transkripsi dulu dan ekspor file subtitle dari editor; tool ini tidak membuat cue dari teks mentah.',
      sections: [
        {
          heading: 'Benarkan timing sebelum unggah',
          paragraphs: [
            'Buka .srt atau .vtt di editor teks dan pastikan cue pertama cocok dengan kalimat pertama. File yang telat 1,5 detik akan terasa “rusak” setelah burn-in meski job berhasil.',
            'Pakai bahasa dan kecepatan baca seperti di televisi. Dua baris, sekitar 42 karakter, adalah default yang bekerja. Satu paragraf per cue akan overflow.',
          ],
        },
        {
          heading: 'Burn-in vs file caption terpisah',
          paragraphs: [
            'Burning mengecat piksel ke gambar. Semua pemutar akan menampilkannya; tidak ada yang bisa mematikannya. Muxing menyimpan trek caption jika kontainer dan pemutar mendukungnya. Jika Anda butuh aksesibilitas yang bisa dimatikan pengguna, lebih baik trek terpisah di NLE. Tambah Subtitle di Kits adalah job burn/mux untuk file yang sudah di-time.',
            'Unggahan dibatasi 100 MB. Timeline 4K panjang mungkin perlu encode proxy lebih kecil sebelum langkah ini.',
          ],
        },
        {
          heading: 'Jika Anda masih butuh transkrip',
          paragraphs: [
            'Ekstrak Audio dari Video, jalankan Speech to Text, lalu buat .srt di tool caption. Baru kembali ke Tambah Subtitle. Melewatkan langkah timing adalah alasan umum orang mengira “subtitle otomatis gagal.”',
          ],
        },
      ],
    },
  },
]

export function getGuide(slug: string) {
  return guideArticles.find((article) => article.slug === slug)
}

export function guideCopy(article: GuideArticle, locale: Locale) {
  return copy(locale, article)
}

export function guidesForTool(slug: string) {
  return guideArticles.filter((article) => article.toolSlugs.includes(slug))
}

export function guidePath(slug: string) {
  return `/guides/${slug}`
}

export function guideJsonLd(slug: string, locale: Locale) {
  const article = getGuide(slug)
  if (!article) return null
  const item = guideCopy(article, locale)
  const path = locale === 'id' ? `/id${guidePath(slug)}` : guidePath(slug)
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: item.title,
    description: item.description,
    inLanguage: locale,
    url: absoluteUrl(path),
  }
}
