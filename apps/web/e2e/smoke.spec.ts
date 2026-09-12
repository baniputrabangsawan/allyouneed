import { deflateSync } from 'node:zlib'
import { expect, test, type Page } from '@playwright/test'

async function waitForClient(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#main-content')
    if (!root) return false
    return Object.keys(root).some((key) => key.startsWith('__react'))
  })
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer) {
  const header = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([header, data])))
  return Buffer.concat([length, header, data, crc])
}

function pngBuffer(width: number, height: number) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const rows: Buffer[] = []
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3)
    for (let x = 0; x < width; x += 1) {
      row[1 + x * 3] = 0
      row[2 + x * 3] = 255
      row[3 + x * 3] = 0
    }
    rows.push(row)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

test('searches and opens a working tool', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Every tool you need/i })).toBeVisible()
  await page.getByRole('combobox', { name: 'Search tools' }).fill('json')
  await page.locator('#all-tools').getByRole('link', { name: /JSON Formatter/ }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'JSON Formatter' })).toBeVisible()
  await page.getByLabel('JSON input').fill('{"project":"Kits","status":"working"}')
  await page.getByRole('button', { name: 'JSON Formatter' }).click()
  expect(errors).toEqual([])
  await expect(page.getByLabel('JSON result')).toHaveValue(/"status": "working"/)
})

test('formats JavaScript in the browser', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/javascript-formatter')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'JavaScript Formatter' })).toBeVisible()
  await expect(page.getByText('is not available yet')).toHaveCount(0)
  await page.getByLabel('JavaScript input').fill('function greet(name){return "hi "+name}')
  await page.getByRole('button', { name: 'Format' }).click()
  await expect(page.getByLabel('JavaScript result')).toHaveValue(/function greet\(name\) \{\n {2}return "hi " \+ name;\n\}/)
  expect(errors).toEqual([])
})

test('formats HTML in the browser without executing it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    if (error.message.includes('Switched to client rendering')) return
    errors.push(error.message)
  })
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/api/')) requests.push(`${request.method()} ${request.url()}`)
  })
  await page.goto('/html-formatter')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'HTML Formatter' })).toBeVisible()
  await expect(page.getByText('is not available yet')).toHaveCount(0)
  await page.getByLabel('HTML input').fill('<section><div><p>Hi</p><script>document.title="pwned"</script></div></section>')
  await page.getByRole('button', { name: 'Format' }).click()
  await expect(page.getByLabel('HTML result')).toHaveValue(/<section>\n {2}<div>\n {4}<p>Hi<\/p>\n {4}<script>\n {6}document.title="pwned"\n {4}<\/script>\n {2}<\/div>\n<\/section>/)
  await expect(page).toHaveTitle(/HTML Formatter/i)
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('opens html-to-image with HTML input', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/html-to-image')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'HTML to Image' })).toBeVisible()
  await expect(page.getByText('is not available yet')).toHaveCount(0)
  await expect(page.getByLabel('HTML')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Process' })).toBeEnabled()
  expect(errors).toEqual([])
})

test('opens favicon generator with a local dropzone', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/favicon-generator')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'Favicon Generator' })).toBeVisible()
  await expect(page.getByText('Drop or paste your file here')).toBeVisible()
  await expect(page.getByText('is not available yet')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('opens crop-image with crop controls', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/crop-image')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'Crop Image' })).toBeVisible()
  await expect(page.getByText('Drop or paste your file here')).toBeVisible()
  expect(errors).toEqual([])
})

test('opens photo editor and exports a PNG', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/api/')) requests.push(`${request.method()} ${request.url()}`)
  })
  await page.goto('/photo-editor')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'Photo Editor' })).toBeVisible()
  await expect(page.getByText('is not available yet')).toHaveCount(0)
  await expect(page.getByText('Drop or paste your file here')).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: pngBuffer(32, 16),
  })
  await expect(page.getByRole('img', { name: 'Edited preview' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Output format' }).selectOption('image/png')
  await page.getByRole('button', { name: 'Export image' }).click()
  await expect(page.getByRole('button', { name: 'Download again' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download again' }).click()
  const file = await download
  const stream = await file.createReadStream()
  expect(stream, 'download stream').not.toBeNull()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const bytes = Buffer.concat(chunks)
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(bytes.readUInt32BE(16)).toBe(32)
  expect(bytes.readUInt32BE(20)).toBe(16)
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('opens a QR generator and a PDF workspace', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/qr-code-generator')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'QR Code Generator' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Text' }).fill('hello kits')
  await expect(page.getByRole('textbox', { name: 'Text' })).toHaveValue('hello kits')
  await page.getByRole('button', { name: 'Generate QR code' }).click()
  await expect(page.getByRole('img', { name: 'Generated QR code' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled()
  await page.goto('/merge-pdf')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'Merge PDF' })).toBeVisible()
  await expect(page.getByText('Drop or paste your files here')).toBeVisible()
  expect(errors).toEqual([])
})

test('opens voice recorder and records with a mocked microphone', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    class FakeMediaRecorder {
      static isTypeSupported(type) {
        return type === 'audio/webm' || type === 'audio/webm;codecs=opus'
      }
      state = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable = null
      onstop = null
      onerror = null
      start() { this.state = 'recording' }
      pause() { this.state = 'paused' }
      resume() { this.state = 'recording' }
      stop() {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' }) })
        this.onstop?.()
      }
    }
    window.MediaRecorder = FakeMediaRecorder
    const track = { kind: 'audio', readyState: 'live', stop() {} }
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
    const mediaDevices = navigator.mediaDevices ?? {}
    mediaDevices.getUserMedia = async () => stream
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: mediaDevices })
  })
  await page.goto('/voice-recorder')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'Voice Recorder' })).toBeVisible()
  await expect(page.getByText('is not available yet')).toHaveCount(0)
  await expect(page.getByText('Idle', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.getByText('Recording', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByText('Recording', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByText('Completed', { exact: true })).toBeVisible()
  await expect(page.locator('audio[aria-label="Recording preview"]')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Download' })).toBeVisible()
  await expect(page.getByText(/WebM/)).toBeVisible()
  await expect(page.getByText(/MP3/)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('converts pasted SVG to a real PNG in the browser', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/api/')) requests.push(`${request.method()} ${request.url()}`)
  })
  await page.goto('/svg-to-png')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'SVG to PNG' })).toBeVisible()
  await expect(page.getByText('is not available yet')).toHaveCount(0)
  await page.getByLabel('SVG markup').fill('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><rect width="32" height="16" fill="#00ff00"/></svg>')
  await page.getByRole('button', { name: 'Use pasted SVG' }).click()
  await expect(page.getByRole('img', { name: 'Selected SVG' })).toBeVisible()
  await page.getByRole('button', { name: 'Convert to PNG' }).click()
  await expect(page.getByRole('img', { name: 'Converted PNG' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download again' }).click()
  const file = await download
  const stream = await file.createReadStream()
  expect(stream, 'download stream').not.toBeNull()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const bytes = Buffer.concat(chunks)
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(bytes.readUInt32BE(16)).toBe(32)
  expect(bytes.readUInt32BE(20)).toBe(16)
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('renders meme captions onto a downloaded PNG without uploading', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    if (error.message.includes('Switched to client rendering')) return
    errors.push(error.message)
  })
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/api/')) requests.push(`${request.method()} ${request.url()}`)
  })
  await page.goto('/meme-generator')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'Meme Generator' })).toBeVisible()
  await expect(page.getByText('is not available yet')).toHaveCount(0)
  const png = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 160
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available.')
    context.fillStyle = '#ff0000'
    context.fillRect(0, 0, 240, 160)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((next) => next ? resolve(next) : reject(new Error('PNG encode failed.')), 'image/png')
    })
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  await page.locator('input[type=file]').setInputFiles({
    name: 'panel.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png),
  })
  await expect(page.getByRole('img', { name: 'Selected meme image' })).toBeVisible()
  await page.getByLabel('Top text').fill('KITS')
  await page.getByLabel('Bottom text').fill('MEME')
  await page.getByRole('button', { name: 'Generate meme' }).click()
  await expect(page.getByRole('img', { name: 'Rendered meme' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download again' }).click()
  const file = await download
  const stream = await file.createReadStream()
  expect(stream, 'download stream').not.toBeNull()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const bytes = Buffer.concat(chunks)
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(bytes.readUInt32BE(16)).toBe(240)
  expect(bytes.readUInt32BE(20)).toBe(160)
  const sample = await page.evaluate(async (b64) => {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('PNG could not be decoded.'))
      image.src = `data:image/png;base64,${b64}`
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available.')
    context.drawImage(image, 0, 0)
    const data = context.getImageData(0, 0, image.width, image.height).data
    let nonRed = 0
    let dark = 0
    let light = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      if (r < 250 || g > 10 || b > 10) nonRed += 1
      if (r < 40 && g < 40 && b < 40) dark += 1
      if (r > 220 && g > 220 && b > 220) light += 1
    }
    return { nonRed, dark, light }
  }, bytes.toString('base64'))
  expect(sample.nonRed).toBeGreaterThan(80)
  expect(sample.light).toBeGreaterThan(20)
  expect(sample.dark).toBeGreaterThan(20)
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})
