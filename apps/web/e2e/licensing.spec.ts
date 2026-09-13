import { expect, test, type Page } from '@playwright/test'
import {
  activateLicenseOnPage,
  issueLicense,
  revokeLicense,
} from './support/licensing'

async function waitForClient(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#main-content')
    if (!root) return false
    const hydrated = Object.keys(root).some((key) => key.startsWith('__react'))
    return (
      hydrated &&
      Boolean(window.localStorage.getItem('utility:installation-id'))
    )
  })
}

async function activateOnPage(page: Page, licenseKey: string) {
  await activateLicenseOnPage(page, licenseKey)
  await expectLockedHeading(page, 0)
}

function lockedHeading(page: Page) {
  return page.getByRole('heading', {
    name: 'Activate a Pro license to use this tool.',
  })
}

async function expectLockedHeading(page: Page, count: number) {
  await expect(lockedHeading(page)).toHaveCount(count)
}

async function expectLocked(page: Page) {
  await expect(lockedHeading(page)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Activate License' }),
  ).toBeVisible()
}

async function expectUnlocked(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'Remove Background', level: 1 }),
  ).toBeVisible()
  await expectLockedHeading(page, 0)
  await expect(
    page.getByRole('link', { name: 'Pro', exact: true }),
  ).toBeVisible()
}

test.describe('licensing', () => {
  test('free tools stay open and one license maps to one installation', async ({
    browser,
    page,
    request,
  }) => {
    test.setTimeout(90_000)
    const issued = await issueLicense(request)

    await page.goto('/')
    await waitForClient(page)
    await expect(
      page.getByRole('heading', { name: /Every tool you need/i }),
    ).toBeVisible()

    await page.goto('/json-formatter')
    await waitForClient(page)
    await expect(
      page.getByRole('heading', { name: 'JSON Formatter', level: 1 }),
    ).toBeVisible()
    await expect(page.getByLabel('JSON input')).toBeVisible()

    await page.goto('/remove-background')
    await waitForClient(page)
    await expectLocked(page)
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Activate Pro' }),
    ).toBeVisible()

    await activateOnPage(page, issued.licenseKey)
    await expectUnlocked(page)

    await page.reload()
    await waitForClient(page)
    await expectUnlocked(page)
    await expect(
      page.getByText(/Pro 1 Month is active on this device/),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Pro', exact: true }),
    ).toBeVisible()

    const second = await browser.newContext()
    const other = await second.newPage()
    await other.goto('/remove-background')
    await waitForClient(other)
    await expectLocked(other)
    await other.getByLabel('License key').fill(issued.licenseKey)
    await expect(other.getByLabel('License key')).toHaveValue(issued.licenseKey)
    const rejected = other.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/v1/licenses/activate'),
    )
    await other.getByRole('button', { name: 'Activate License' }).click()
    expect((await rejected).status()).toBe(409)
    await expect(other.getByRole('alert')).toHaveText(
      'This license is already active on another browser.',
    )

    await page.goto('/license')
    await waitForClient(page)
    await page.getByRole('button', { name: 'Deactivate this device' }).click()
    await page.getByRole('button', { name: 'Confirm deactivate' }).click()
    await expect(
      page.getByText('Paste a Pro license key. No account is created.'),
    ).toBeVisible()

    await other.goto('/remove-background')
    await waitForClient(other)
    await activateOnPage(other, issued.licenseKey)
    await expectUnlocked(other)

    await revokeLicense(request, issued.licenseId)
    await other.reload()
    await waitForClient(other)
    await expectLocked(other)
    await expect(
      other.getByRole('banner').getByRole('link', { name: 'Activate Pro' }),
    ).toBeVisible()

    await second.close()
  })
})
