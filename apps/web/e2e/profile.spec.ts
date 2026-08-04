import { expect, test } from '@playwright/test'

// P05 E2E — the branch profile screen «بيانات الفرع», Branch Details design.
//
// The phone fields render as 🇪🇬 +20 + the NATIONAL part, so every value in
// this file is national: the seeded hotline shows verbatim ("15276"), a
// landline shows without its leading 0.
//
// ⚠ These tests MUTATE the branches row (phone) and RESTORE it in the same
// test — branches is NOT reseeded by 004, so a drifting value here would
// follow the shared dev DB around (§9). The start-guard below also repairs the
// canonical seed value if a previous run crashed between probe and restore.
// No booking fixtures are consumed: the FIXTURE TRIPWIRE count is unaffected.

const PROVIDER_EMAIL = process.env.PROVIDER_TEST_EMAIL ?? ''
const PROVIDER_PASSWORD = process.env.PROVIDER_TEST_PASSWORD ?? ''
const HAS_CREDS = PROVIDER_EMAIL.length > 0 && PROVIDER_PASSWORD.length > 0

// Town's seeded hotline (supabase/seeds/002) — hotlines display verbatim.
// Used ONLY by the start-guard; the round-trip restores whatever it found.
const SEEDED_PHONE_NATIONAL = '15276'
// National landline probe → stored as "02 8888 8888".
const PROBE_PHONE_NATIONAL = '2 8888 8888'

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

async function saveAndExpectToast(page: import('@playwright/test').Page) {
  await page.getByTestId('profile-save').click()
  // The design's saved feedback is the contract Toast, which auto-dismisses.
  await expect(page.getByTestId('profile-saved')).toBeVisible({ timeout: 30_000 })
}

test.describe('provider dashboard — branch profile (P05, Branch Details design)', () => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await login(page)
    await openProfile(page)
    // Start-guard: a previous run that crashed between probe and restore left
    // the probe value behind. Repair to the seed value so the round-trip
    // below starts from reality.
    const current = await page.getByTestId('profile-phone').inputValue()
    if (current === PROBE_PHONE_NATIONAL) {
      await page.getByTestId('profile-phone').fill(SEEDED_PHONE_NATIONAL)
      await saveAndExpectToast(page)
    }
  })

  test('renders the two-card layout with editable fields and the locked card', async ({ page }) => {
    await expect(page.getByTestId('profile-phone')).toBeEnabled()
    await expect(page.getByTestId('profile-whatsapp')).toBeEnabled()
    await expect(page.getByTestId('profile-address-ar')).toBeEnabled()
    await expect(page.getByTestId('profile-address-en')).toBeEnabled()

    // The +20 country prefix is visible beside both phone fields.
    await expect(page.getByText('+20').first()).toBeVisible()

    // «آخر تحديث» is honest: either a real relative label or «لم يُحدَّث بعد».
    await expect(page.getByTestId('profile-updated')).toBeVisible()

    // The locked card names the owner, carries the design's chips and status
    // badge, and contains ZERO operable controls. The support mailto link is
    // the one allowed anchor.
    const gated = page.getByTestId('profile-gated')
    await expect(gated).toBeVisible()
    await expect(gated).toContainText('تديرها إنستاهيلث')
    await expect(gated).toContainText('تواصل مع إنستاهيلث')
    await expect(gated.locator('button, input, select, textarea')).toHaveCount(0)
    await expect(page.getByTestId('profile-support')).toHaveAttribute('href', /^mailto:/)
  })

  test('a phone edit round-trips: save toast, persists across reload, restore', async ({
    page,
  }) => {
    const phone = page.getByTestId('profile-phone')
    const original = await phone.inputValue()

    await phone.fill(PROBE_PHONE_NATIONAL)
    await saveAndExpectToast(page)

    // The value on screen after save is the SERVER's answer (the confirming
    // refetch), and it must survive a full reload — still in national form.
    await page.reload()
    await expect(page.getByTestId('profile-phone')).toHaveValue(PROBE_PHONE_NATIONAL, {
      timeout: 30_000,
    })

    // Restore — leave the shared dev DB exactly as found.
    await page.getByTestId('profile-phone').fill(original)
    await saveAndExpectToast(page)
    await expect(page.getByTestId('profile-phone')).toHaveValue(original)
  })

  test('an invalid WhatsApp shows the field error and DISABLES save', async ({ page }) => {
    // A 5-digit hotline cannot receive WhatsApp — core's schema catches it
    // while typing, and per the design the save button disables rather than
    // letting a doomed request start.
    await page.getByTestId('profile-whatsapp').fill('15276')
    await expect(page.getByRole('alert').filter({ hasText: 'موبايل' })).toBeVisible()
    await expect(page.getByTestId('profile-save')).toBeDisabled()
    await expect(page.getByTestId('profile-saved')).not.toBeVisible()

    // Clearing the field clears the refusal.
    await page.getByTestId('profile-whatsapp').fill('')
    await expect(page.getByRole('alert').filter({ hasText: 'موبايل' })).not.toBeVisible()
  })

  test('an untouched form cannot be saved', async ({ page }) => {
    await expect(page.getByTestId('profile-save')).toBeDisabled()
  })
})
