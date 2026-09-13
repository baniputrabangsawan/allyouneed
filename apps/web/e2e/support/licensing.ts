import { expect, type APIRequestContext, type Page } from '@playwright/test'

const API_BASE_URL = (
  process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8010'
).replace(/\/+$/, '')

export async function issueLicense(
  request: APIRequestContext,
): Promise<{ licenseId: string; licenseKey: string }> {
  const login = await request.post(`${API_BASE_URL}/api/v1/admin/auth/login`, {
    data: {
      email: 'owner@example.com',
      password: 'correct horse battery staple',
    },
  })
  expect(login.ok(), await login.text()).toBeTruthy()
  const csrf = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === 'kits_admin_csrf',
  )?.value
  const response = await request.post(`${API_BASE_URL}/api/v1/admin/licenses`, {
    data: { durationMonths: 1 },
    headers: { 'X-CSRF-Token': csrf ?? '' },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const body = (await response.json()) as {
    data: { licenseId: string; licenseKey: string }
  }
  return body.data
}

export async function revokeLicense(
  request: APIRequestContext,
  licenseId: string,
): Promise<void> {
  const csrf = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === 'kits_admin_csrf',
  )?.value
  const response = await request.post(
    `${API_BASE_URL}/api/v1/admin/licenses/${licenseId}/revoke`,
    { headers: { 'X-CSRF-Token': csrf ?? '' } },
  )
  expect(response.ok(), await response.text()).toBeTruthy()
}

export async function activateLicenseOnPage(
  page: Page,
  licenseKey: string,
): Promise<void> {
  const input = page.getByLabel('License key')
  await expect(input).toBeEditable()
  await input.fill(licenseKey)
  const activation = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/api/v1/licenses/activate'),
  )
  await page.getByRole('button', { name: 'Activate License' }).click()
  const response = await activation
  expect(response.ok(), await response.text()).toBeTruthy()
  await expect(
    page.getByRole('link', { name: 'Pro', exact: true }),
  ).toBeVisible()
}
