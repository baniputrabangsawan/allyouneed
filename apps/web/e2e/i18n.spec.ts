import { expect, test } from '@playwright/test'

test('English home stays unprefixed', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Every tool you need/ })).toBeVisible()
})

test('Indonesian home uses /id and lang=id', async ({ page }) => {
  await page.goto('/id')
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  await expect(page.getByRole('heading', { name: /Semua tool yang Anda butuhkan/ })).toBeVisible()
})

test('Indonesian docs guide loads from /id URL', async ({ page }) => {
  await page.goto('/id/docs/tools/compress-image')
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  await expect(page.getByRole('heading', { name: 'Kompres Gambar' })).toBeVisible()
})

test('docs language switch keeps the same guide', async ({ page }) => {
  await page.goto('/docs/tools/compress-image')
  await page.locator('.header-actions .language-switcher-button').click()
  await expect(page).toHaveURL(/\/id\/docs\/tools\/compress-image/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  await expect(page.getByRole('heading', { name: 'Kompres Gambar' })).toBeVisible()
  await page.locator('.header-actions .language-switcher-button').click()
  await expect(page).toHaveURL(/\/docs\/tools\/compress-image/)
  await expect(page.getByRole('heading', { name: 'Compress Image' })).toBeVisible()
})

test('language switch preserves search params', async ({ page }) => {
  await page.goto('/?q=image&category=image&group=convert#all-tools')
  await page.locator('.header-actions .language-switcher-button').click()
  await expect(page).toHaveURL(/\/id\/?\?q=image&category=image&group=convert/)
})

test('language switch keeps the current scroll position', async ({ page }) => {
  await page.goto('/docs/getting-started')
  await page.getByRole('heading', { name: 'Getting started' }).waitFor()
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo(0, 480)
  })
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(300)
  await page.locator('.header-actions .language-switcher-button').click()
  await expect(page).toHaveURL(/\/id\/docs\/getting-started/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  await expect(page.getByRole('heading', { name: 'Memulai' })).toBeVisible()
  const after = await page.evaluate(() => window.scrollY)
  expect(Math.abs(after - before)).toBeLessThan(120)
})

test('Indonesian pricing page is translated', async ({ page }) => {
  await page.goto('/id/pricing')
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  await expect(page.getByRole('heading', { name: /Harga sederhana/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pro — 6 Bulan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ambil 6 Bulan' })).toBeVisible()
})

test('Indonesian docs articles and guides are translated', async ({ page }) => {
  await page.goto('/id/docs')
  await expect(page.getByRole('heading', { name: 'Pelajari cara memakai setiap tool.' })).toBeVisible()
  await page.goto('/id/docs/getting-started')
  await expect(page.getByRole('heading', { name: 'Memulai' })).toBeVisible()
  await expect(page.getByText(/sebagian besar tool berjalan lokal/i)).toBeVisible()
  await page.goto('/id/docs/tools/compress-image')
  await expect(page.getByRole('heading', { name: 'Cara menggunakan' })).toBeVisible()
  await expect(page.getByText('Buka Kompres Gambar.')).toBeVisible()
})
