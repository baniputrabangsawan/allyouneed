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

async function readDownloadPng(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download again' }).click()
  const file = await download
  const stream = await file.createReadStream()
  expect(stream, 'download stream').not.toBeNull()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

test('merges two PNGs locally with reorder, vertical, and horizontal layouts', async ({ page }) => {
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/api/v1/uploads') || url.includes('/api/v1/jobs') || url.includes('/r2') || url.includes('/api/v1/files')) {
      requests.push(`${request.method()} ${url}`)
    }
  })

  await page.goto('/merge-png')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'Merge PNG' })).toBeVisible()
  await expect(page.getByText('is not available yet')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Merge PNG' })).toBeDisabled()

  await page.locator('input[type=file]').setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: pngBuffer(32, 16) },
    { name: 'second.png', mimeType: 'image/png', buffer: pngBuffer(24, 24) },
  ])
  await expect(page.getByText('first.png')).toBeVisible()
  await expect(page.getByText('second.png')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Merge layout preview' })).toBeVisible()

  const names = page.locator('.merge-file-meta strong')
  await expect(names.nth(0)).toHaveText('first.png')
  await expect(names.nth(1)).toHaveText('second.png')
  await page.getByRole('button', { name: 'Move down' }).first().click()
  await expect(names.nth(0)).toHaveText('second.png')
  await expect(names.nth(1)).toHaveText('first.png')

  await page.getByRole('button', { name: 'Vertical' }).click()
  await page.getByRole('button', { name: 'Merge PNG' }).click()
  await expect(page.getByRole('img', { name: 'Merged PNG result' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download again' })).toBeVisible()
  await expect(page.getByText('32×40px')).toBeVisible()

  const vertical = await readDownloadPng(page)
  expect([...vertical.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(vertical.readUInt32BE(16)).toBe(32)
  expect(vertical.readUInt32BE(20)).toBe(40)

  await page.getByRole('button', { name: 'Horizontal' }).click()
  await page.getByRole('button', { name: 'Merge PNG' }).click()
  await expect(page.getByText('56×24px')).toBeVisible()
  const horizontal = await readDownloadPng(page)
  expect([...horizontal.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(horizontal.readUInt32BE(16)).toBe(56)
  expect(horizontal.readUInt32BE(20)).toBe(24)

  await page.getByRole('button', { name: 'Grid' }).click()
  await page.getByRole('button', { name: 'Merge PNG' }).click()
  await expect(page.getByText('56×24px')).toBeVisible()
  const grid = await readDownloadPng(page)
  expect([...grid.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(grid.readUInt32BE(16)).toBe(56)
  expect(grid.readUInt32BE(20)).toBe(24)

  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('merge png docs stay client-side and available', async ({ page }) => {
  await page.goto('/docs/tools/merge-png')
  await expect(page.getByRole('heading', { name: 'Merge PNG' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Merge PNG' })).toHaveAttribute('href', '/merge-png')
  await expect(page.getByText('Coming Soon. This tool is still under development.')).toHaveCount(0)
  await expect(page.getByText(/does not need to be uploaded to the Kits processing server/i)).toBeVisible()
})
