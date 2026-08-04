import { expect, test } from '@playwright/test'

// P05 E2E — the branch profile screen «بيانات الفرع».
//
// ⚠ These tests MUTATE the branches row (phone) and RESTORE it in the same
// test — branches is NOT reseeded by 004, so a drifting value here would
// follow the shared dev DB around (§9). The start-guard below also repairs the
// canonical seed value if a previous run crashed between probe and restore.
// No booking fixtures are consumed: the FIXTURE TRIPWIRE count is unaffected.

const PROVIDER_EMAIL = process.env.PROVIDER_TEST_EMAIL ?? ''
const PROVIDER_PASSWORD = process.env.PROVIDER_TEST_PASSWORD ?? ''
const HAS_CREDS = PROVIDER_EMAIL.length > 0 && PROVIDER_PASSWORD.length > 0

// Town's seeded hotline (supabase/seeds/002). Used ONLY by the start-guard to
// repair a crashed previous run — the round-trip itself restores whatever it
// found.
const SEEDED_PHONE = '15276'
const PROBE_PHONE = '02-88888888'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(PROVIDER_EMAIL)
  await page.getByTestId('login-password').fill(PROVIDER_PASSWORD)
  await page.getByTestId('login-submit').click()
  await page.waitForURL('**/dashboard/today')
}

async function openProfile(page: import('@playwright/test').Page) {
  await page.getByTestId('nav-profile').click()
  await page.waitForURL('**/dashboard/profile')
  // Wait for CONTENT, not the URL — waitForURL resolves before the RSC
  // payload paints (§9).
  await expect(page.getByTestId('profile-phone')).toBeVisible({ timeout: 30_000 })
}

async function saveAndExpectConfirmation(page: import('@playwright/test').Page) {
  await page.getByTestId('profile-save').click()
  await expect(page.getByTestId('profile-saved')).toBeVisible({ timeout: 30_000 })
}

test.describe('provider dashboard — branch profile (P05)', () => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await login(page)
    await openProfile(page)
    // Start-guard: a previous run that crashed between probe and restore left
    // the probe value behind. Repair to the seed value so the round-trip
    // below starts from reality.
    const current = await page.getByTestId('profile-phone').inputValue()
    if (current === PROBE_PHONE) {
      await page.getByTestId('profile-phone').fill(SEEDED_PHONE)
      await saveAndExpectConfirmation(page)
    }
  })

  test('renders the profile with editable contact fields and the gated card', async ({ page }) => {
    await expect(page.getByTestId('profile-phone')).toBeEnabled()
    await expect(page.getByTestId('profile-whatsapp')).toBeEnabled()
    await expect(page.getByTestId('profile-address-ar')).toBeEnabled()
    await expect(page.getByTestId('profile-address-en')).toBeEnabled()

    // «آخر تحديث» is honest: either a real relative label or «لم يُحدَّث بعد»,
    // never an invented date.
    await expect(page.getByTestId('profile-updated')).toBeVisible()

    // The gated card names the owner and contains ZERO operable controls —
    // the P04 treatment. The support mailto link is the one allowed anchor.
    const gated = page.getByTestId('profile-gated')
    await expect(gated).toBeVisible()
    await expect(gated).toContainText('تواصل مع إنستاهيلث')
    await expect(gated.locator('button, input, select, textarea')).toHaveCount(0)
    await expect(page.getByTestId('profile-support')).toHaveAttribute('href', /^mailto:/)
  })

  test('a phone edit round-trips: save, persists across reload, restore', async ({ page }) => {
    const phone = page.getByTestId('profile-phone')
    const original = await phone.inputValue()

    await phone.fill(PROBE_PHONE)
    await saveAndExpectConfirmation(page)

    // The value on screen after save is the SERVER's answer (the confirming
    // refetch), and it must survive a full reload.
    await page.reload()
    await expect(page.getByTestId('profile-phone')).toHaveValue(PROBE_PHONE, { timeout: 30_000 })

    // Restore — leave the shared dev DB exactly as found.
    await page.getByTestId('profile-phone').fill(original)
    await saveAndExpectConfirmation(page)
    await expect(page.getByTestId('profile-phone')).toHaveValue(original)
  })

  test('an invalid WhatsApp is refused while typing, before any request', async ({ page }) => {
    // A landline cannot receive WhatsApp — core's schema catches it client-side.
    await page.getByTestId('profile-whatsapp').fill('02-25787202')
    await page.getByTestId('profile-save').click()
    await expect(page.getByRole('alert').filter({ hasText: 'واتساب' })).toBeVisible()
    await expect(page.getByTestId('profile-saved')).not.toBeVisible()

    // Clearing the field clears the refusal and nothing was saved.
    await page.getByTestId('profile-whatsapp').fill('')
    await expect(page.getByRole('alert').filter({ hasText: 'واتساب' })).not.toBeVisible()
  })

  test('an untouched form cannot be saved', async ({ page }) => {
    await expect(page.getByTestId('profile-save')).toBeDisabled()
  })
})
