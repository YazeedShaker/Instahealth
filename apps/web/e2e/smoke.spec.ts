import { expect, test } from '@playwright/test'

// The root used to render SETUP-01's scaffold placeholder, and this test
// asserted on its Arabic heading. That page is gone: the root is now a
// server-side signpost, so the smoke test asserts the SIGNPOST — that the app
// boots, is RTL, and sends an anonymous visitor to the portal rather than
// showing them anything of its own.

test('app boots and sends an anonymous visitor to the portal', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'بوابة الشركاء' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})

test('the root renders no content of its own', async ({ page }) => {
  const response = await page.goto('/')
  // A redirect, not a page. The assertion is on the placeholder's OWN copy, so
  // it fails loudly if the scaffold page ever creeps back.
  expect(response?.url()).toContain('/login')
  await expect(page.getByText('منصة الحجوزات الطبية', { exact: false })).toHaveCount(0)
})
