import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

async function waitForClient(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#main-content')
    if (!root) return false
    return Object.keys(root).some((key) => key.startsWith('__react'))
  })
}

function wavBytes() {
  const samples = 4410
  const dataSize = samples * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(44100, 24)
  buffer.writeUInt32LE(88200, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  return buffer
}

function maybeMp4(): string | null {
  try {
    const dir = mkdtempSync(join(tmpdir(), 'kits-media-'))
    const path = join(dir, 'clip.mp4')
    execFileSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x48:d=0.2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.2',
      '-shortest', '-pix_fmt', 'yuv420p', path,
    ], { stdio: 'ignore' })
    return path
  } catch {
    return null
  }
}

test('previews a local WAV on Audio Converter without calling the API', async ({ page }) => {
  const uploads: string[] = []
  await page.route('**/api/v1/uploads/**', async (route) => {
    uploads.push(route.request().url())
    await route.abort()
  })
  await page.route('**/api/v1/jobs/**', async (route) => {
    uploads.push(route.request().url())
    await route.abort()
  })
  await page.goto('/audio-converter')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'Audio Converter' })).toBeVisible()
  await expect(page.getByText('MPEG')).toHaveCount(0)
  await expect(page.locator('small', { hasText: 'MP3, WAV, M4A' })).toBeVisible()
  const input = page.locator('input[type="file"]')
  await input.setInputFiles({ name: 'recording-20260911-180608.webm', mimeType: 'audio/webm', buffer: wavBytes() })
  await expect(page.getByText(/recording-20260911-180608\.webm/)).toBeVisible()
  await expect(page.getByText('Failed to fetch')).toHaveCount(0)
  const audio = page.locator('audio[aria-label="Input preview"]')
  await expect(audio).toBeVisible()
  await expect.poll(async () => audio.getAttribute('src')).toMatch(/^blob:/)
  expect(uploads).toEqual([])
})

test('previews a local video without calling the API', async ({ page }) => {
  const mp4 = maybeMp4()
  test.skip(!mp4, 'ffmpeg')
  const uploads: string[] = []
  await page.route('**/api/v1/uploads/**', async (route) => {
    uploads.push(route.request().url())
    await route.abort()
  })
  await page.goto('/video-compressor')
  await waitForClient(page)
  await page.locator('input[type="file"]').setInputFiles(mp4!)
  await expect(page.getByText('Failed to fetch')).toHaveCount(0)
  const video = page.locator('video[aria-label="Input preview 1"]')
  await expect(video).toBeVisible()
  await expect.poll(async () => video.getAttribute('src')).toMatch(/^blob:/)
  expect(uploads).toEqual([])
})

test('accepts MediaRecorder WebM on Noise Reduction', async ({ page }) => {
  await page.goto('/noise-reduction')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: /Noise Reduction|Reduksi Noise/ })).toBeVisible()
  await expect(page.getByLabel(/Noise reduction strength|Kekuatan reduksi noise/)).toBeVisible()
  await expect(page.getByText('Opsi lanjutan (JSON)')).toHaveCount(0)
  const input = page.locator('input[type="file"]')
  await input.setInputFiles({
    name: 'recording-20260911-180608.webm',
    mimeType: 'video/webm;codecs=opus',
    buffer: wavBytes(),
  })
  await expect(page.getByText(/recording-20260911-180608\.webm/)).toBeVisible()
  await expect(page.getByText('Format file tidak didukung.')).toHaveCount(0)
  await expect(page.getByText('Unsupported file format.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Process|Proses/ })).toBeEnabled()
})

test('accepts empty-MIME WebM on Audio Converter', async ({ page }) => {
  await page.goto('/audio-converter')
  await waitForClient(page)
  await page.locator('input[type="file"]').setInputFiles({
    name: 'recording-20260911-180608.webm',
    mimeType: '',
    buffer: wavBytes(),
  })
  await expect(page.getByText(/recording-20260911-180608\.webm/)).toBeVisible()
  await expect(page.getByText('Format file tidak didukung.')).toHaveCount(0)
  await expect(page.getByText('Unsupported file format.')).toHaveCount(0)
})

function maybeAudioWebm(): string | null {
  try {
    const dir = mkdtempSync(join(tmpdir(), 'kits-webm-'))
    const path = join(dir, 'recording-20260911-180608.webm')
    execFileSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.3',
      '-c:a', 'libopus', path,
    ], { stdio: 'ignore' })
    return path
  } catch {
    return null
  }
}

test('processes audio-only WebM through Noise Reduction', async ({ page }) => {
  const webm = maybeAudioWebm()
  test.skip(!webm, 'ffmpeg')
  await page.goto('/noise-reduction')
  await waitForClient(page)
  await page.locator('input[type="file"]').setInputFiles(webm!)
  await expect(page.getByText(/recording-20260911-180608\.webm/)).toBeVisible()
  await expect(page.getByText('Format file tidak didukung.')).toHaveCount(0)
  await page.getByRole('button', { name: /Process|Proses/ }).click()
  await expect(page.getByText(/Completed|Selesai/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: /Download result|Unduh hasil/ })).toBeVisible()
})
