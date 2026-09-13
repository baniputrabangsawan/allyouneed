import { expect, test, type Page } from '@playwright/test'

async function waitForClient(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#main-content')
    return root ? Object.keys(root).some((key) => key.startsWith('__react')) : false
  })
}

test('homepage query state survives reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?q=pdf&category=pdf&group=convert')
  await waitForClient(page)
  await expect(page.getByRole('combobox', { name: 'Search tools' })).toHaveValue('pdf')
  await expect(page.getByRole('button', { name: 'pdf', exact: true })).toHaveAttribute('data-active', 'true')
  await expect(page.locator('.group-tabs button[data-active="true"]')).toHaveText('convert')
  await expect(page.getByRole('heading', { name: /Results for “pdf”|pdf tools/ })).toBeVisible()
  await page.reload()
  await waitForClient(page)
  await expect(page.getByRole('combobox', { name: 'Search tools' })).toHaveValue('pdf')
  await expect(page.getByRole('button', { name: 'pdf', exact: true })).toHaveAttribute('data-active', 'true')
  await expect(page.locator('.group-tabs button[data-active="true"]')).toHaveText('convert')
  await expect(page.getByRole('heading', { name: /Results for “pdf”|pdf tools/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('hard refresh at #all-tools stays on the catalog', async ({ page }) => {
  await page.goto('/?q=&category=all&group=all#all-tools')
  await waitForClient(page)
  const catalog = page.locator('#all-tools')
  await expect(catalog).toBeVisible()
  await expect.poll(async () => catalog.evaluate((node) => node.getBoundingClientRect().top)).toBeLessThan(240)
  await page.reload()
  await waitForClient(page)
  await expect.poll(async () => catalog.evaluate((node) => node.getBoundingClientRect().top)).toBeLessThan(240)
})

test('browser back restores the previous category filter', async ({ page }) => {
  await page.goto('/')
  await waitForClient(page)
  await page.getByRole('button', { name: 'image', exact: true }).click()
  await expect(page.getByRole('button', { name: 'image', exact: true })).toHaveAttribute('data-active', 'true')
  await page.getByRole('button', { name: 'pdf', exact: true }).click()
  await expect(page.getByRole('button', { name: 'pdf', exact: true })).toHaveAttribute('data-active', 'true')
  await page.goBack()
  await expect(page.getByRole('button', { name: 'image', exact: true })).toHaveAttribute('data-active', 'true')
  await page.goBack()
  await expect(page.getByRole('button', { name: 'all', exact: true }).first()).toHaveAttribute('data-active', 'true')
})

test('tool page and pricing survive hard refresh', async ({ page }) => {
  await page.goto('/json-formatter')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: 'JSON Formatter', level: 1 })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'JSON Formatter', level: 1 })).toBeVisible()
  await page.goto('/pricing')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: /Simple pricing/i })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: /Simple pricing/i })).toBeVisible()
})

test('docs deep link hash survives reload', async ({ page }) => {
  await page.goto('/docs/tools/compress-image#how-to')
  await waitForClient(page)
  await expect(page.getByRole('heading', { name: /Compress Image/i }).first()).toBeVisible()
  const before = await page.locator('#how-to').evaluate((node) => node.getBoundingClientRect().top)
  expect(before).toBeLessThan(480)
  await page.reload()
  await waitForClient(page)
  await expect(page.locator('#how-to')).toBeVisible()
  const after = await page.locator('#how-to').evaluate((node) => node.getBoundingClientRect().top)
  expect(after).toBeLessThan(480)
})

test('favorites survive reload', async ({ page }) => {
  await page.goto('/')
  await waitForClient(page)
  await page.evaluate(() => {
    localStorage.setItem('utility:favorites', JSON.stringify(['json-formatter']))
    document.cookie = 'kits_favorites=json-formatter; Path=/; SameSite=Lax'
  })
  await page.reload()
  await waitForClient(page)
  await expect(page.locator('#favorites').getByRole('link', { name: /JSON Formatter/ })).toBeVisible()
})

test('unknown category does not crash', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?category=this-does-not-exist')
  await waitForClient(page)
  await expect(page.getByRole('button', { name: 'all', exact: true }).first()).toHaveAttribute('data-active', 'true')
  await expect(page.getByRole('heading', { name: /Every tool you need/i })).toBeVisible()
  expect(errors).toEqual([])
})

test('unknown tool route stays a 404 after reload', async ({ page }) => {
  await page.goto('/this-tool-does-not-exist')
  await expect(page.getByRole('heading', { name: /Tool not found/i })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: /Tool not found/i })).toBeVisible()
})
