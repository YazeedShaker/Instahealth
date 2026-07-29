import { expect, test } from '@playwright/test'

// Design-fidelity capture. NOT an assertion suite — it exists so any PR
// claiming design fidelity can prove it with comparison screenshots
// (ENGINEERING-WORKFLOW §9). Run it, commit the output, put the images beside
// the design bundle's screens in the PR body.
//
//   pnpm --filter @instahealth/web exec playwright test fidelity --update-snapshots
//
// 1366×768 is the desktop FLOOR from the DESIGN-02 brief ("old office
// machines") — capture at the floor, because that is where layouts break.

const PROVIDER_EMAIL = process.env.PROVIDER_TEST_EMAIL ?? ''
const PROVIDER_PASSWORD = process.env.PROVIDER_TEST_PASSWORD ?? ''
const HAS_CREDS = PROVIDER_EMAIL.length > 0 && PROVIDER_PASSWORD.length > 0

const SHOT_DIR = '../../docs/design-briefs/p01-fidelity'

test.use({ viewport: { width: 1366, height: 768 } })

test('capture: login', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'بوابة الشركاء' })).toBeVisible()
  // Fonts must be settled or the capture shows a fallback face.
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${SHOT_DIR}/login-build.png`, fullPage: false })
})

test('capture: login with an error', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('login-email').fill('wrong@example.com')
  await page.getByTestId('login-password').fill('wrong-password')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('login-error')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${SHOT_DIR}/login-error-build.png`, fullPage: false })
})

test('capture: today', async ({ page }) => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
  await page.goto('/login')
  await page.getByTestId('login-email').fill(PROVIDER_EMAIL)
  await page.getByTestId('login-password').fill(PROVIDER_PASSWORD)
  await page.getByTestId('login-submit').click()
  await page.waitForURL('**/dashboard/today')
  await expect(page.getByTestId('branch-name')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${SHOT_DIR}/today-build.png`, fullPage: false })
})
