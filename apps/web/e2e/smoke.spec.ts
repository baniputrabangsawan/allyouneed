import { expect, test } from '@playwright/test'

test('searches and opens a working tool', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Every tool you need/i })).toBeVisible()
  await page.getByRole('textbox', { name: 'Search tools' }).fill('json')
  await page.locator('#all-tools').getByRole('link', { name: /JSON Formatter/ }).click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'JSON Formatter' })).toBeVisible()
  await page.getByLabel('Input JSON').fill('{"project":"Kits","status":"working"}')
  await page.getByRole('button', { name: 'Format' }).click()
  expect(errors).toEqual([])
  await expect(page.getByLabel('Output')).toHaveValue(/"status": "working"/)
})
