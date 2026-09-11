import { expect, request, test } from '@playwright/test'

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8000'

test('admin dashboard creates and clears a one-time license key', async ({ page }) => {
  const api = await request.newContext({ baseURL: API_BASE_URL })
  try {
    const health = await api.get('/api/v1/health/live', { timeout: 1_000 })
    test.skip(!health.ok(), 'FastAPI must be running for admin E2E.')
  } catch {
    test.skip(true, 'FastAPI must be running for admin E2E.')
  } finally {
    await api.dispose()
  }
  await page.goto('/admin/licenses')
  await expect(page.getByRole('heading', { name: 'Licenses' })).toBeVisible()
  await page.getByRole('button', { name: 'Create license' }).click()
  await page.getByLabel('Duration').selectOption('1')
  await page.getByRole('button', { name: 'Create license', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Copy this key now.' })).toBeVisible()
  const key = await page.locator('.admin-license-key').textContent()
  expect(key).toMatch(/^UTL-PRO-/)
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('body')).not.toContainText(key ?? '')
})
