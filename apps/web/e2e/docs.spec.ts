import { expect, test } from '@playwright/test'

test('/docs renders the landing page', async ({ page }) => {
  await page.goto('/docs')
  await expect(page.getByRole('heading', { name: 'Learn how to use every tool.' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Docs' })).toBeVisible()
  await expect(page.getByPlaceholder('Search docs')).toBeVisible()
})

test('known tool guide has Open Tool CTA', async ({ page }) => {
  await page.goto('/docs/tools/compress-image')
  await expect(page.getByRole('heading', { name: 'Compress Image' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Compress Image' })).toHaveAttribute('href', '/compress-image')
  await expect(page.getByText('Coming Soon. This tool is still under development.')).toHaveCount(0)
})

test('Coming Soon guide does not claim functionality', async ({ page }) => {
  await page.goto('/docs/tools/remove-background')
  await expect(page.getByText('Coming Soon', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Open / })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'How to use' })).toHaveCount(0)
})

test('unknown slug returns a guide-not-found state', async ({ page }) => {
  await page.goto('/docs/tools/not-a-real-tool')
  await expect(page.getByRole('heading', { name: 'Guide not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to Docs' })).toBeVisible()
})

test('docs search finds a tool guide', async ({ page }) => {
  await page.goto('/docs')
  await page.getByPlaceholder('Search tools and guides').fill('merge pdf')
  await expect(page.getByRole('link', { name: /Merge PDF/ })).toBeVisible()
  await page.getByRole('link', { name: /Merge PDF/ }).first().click()
  await expect(page).toHaveURL(/\/docs\/tools\/merge-pdf/)
})

test('getting started and category navigation work', async ({ page }) => {
  await page.goto('/docs/getting-started')
  await expect(page.getByRole('heading', { name: 'Getting started' })).toBeVisible()
  await page.getByRole('link', { name: 'Privacy and processing' }).first().click()
  await expect(page).toHaveURL(/\/docs\/privacy-and-processing/)
})
