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

// ── P02 captures ───────────────────────────────────────────────────────────
// Compare against `design/handoff/project/Provider Dashboard - Booking Detail.dc.html`
// and `… - Upcoming Days.dc.html`.

const P02_SHOT_DIR = '../../docs/design-briefs/p02-fidelity'

/** Next's dev-tools button sits in the bottom-left corner in `next dev` and is
 * NOT part of the design. It landed in the first P02 capture looking like a
 * stray black disc over the drawer footer. */
async function hideDevOverlay(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: 'nextjs-portal, [data-nextjs-dev-tools-button] { display: none !important; }',
  })
}

/** Sign in and go STRAIGHT to a screen, without waiting for the Today table
 * first. The prices captures do not need Today at all, and stacking its
 * server-rendered fetch in front of theirs is what pushed them past the test
 * budget on a CI runner. */
async function signInAndGo(page: import('@playwright/test').Page, path: string) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(PROVIDER_EMAIL)
  await page.getByTestId('login-password').fill(PROVIDER_PASSWORD)
  await page.getByTestId('login-submit').click()
  await page.waitForURL('**/dashboard/**')
  await page.goto(path)
}

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(PROVIDER_EMAIL)
  await page.getByTestId('login-password').fill(PROVIDER_PASSWORD)
  await page.getByTestId('login-submit').click()
  await page.waitForURL('**/dashboard/today')
  // Wait for the TABLE, not just the URL. `waitForURL` resolves before the
  // RSC payload paints, so a `rows.count()` straight after it read 0 and the
  // capture skipped itself — a skip that looked exactly like "no data today".
  // Generous timeout on purpose: this waits on a SERVER-rendered fetch against
  // the remote dev database, and three Playwright workers contend for the dev
  // server. The default 5s is a load-dependent flake, not a real signal.
  await expect(page.getByTestId('bookings-list').or(page.getByTestId('today-empty'))).toBeVisible({
    timeout: 30_000,
  })
}

test('capture: booking detail drawer', async ({ page }) => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
  await signIn(page)

  const rows = page.getByTestId(/^booking-row-/)
  test.skip((await rows.count()) === 0, 'no bookings today at Town to open')

  await rows.first().click()
  await expect(page.getByTestId('booking-drawer')).toBeVisible()
  await hideDevOverlay(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${P02_SHOT_DIR}/drawer-build.png`, fullPage: false })
})

test('capture: cancel-on-behalf confirm', async ({ page }) => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
  await signIn(page)

  const rows = page.getByTestId(/^booking-row-/)
  test.skip((await rows.count()) === 0, 'no bookings today at Town to open')

  // Open the first row that is still cancellable.
  const count = await rows.count()
  for (let index = 0; index < count; index += 1) {
    await rows.nth(index).click()
    if ((await page.getByTestId('drawer-cancel').count()) > 0) break
    await page.getByTestId('drawer-close').click()
  }
  test.skip(
    (await page.getByTestId('drawer-cancel').count()) === 0,
    'every booking today is already closed',
  )

  await page.getByTestId('drawer-cancel').click()
  await expect(page.getByTestId('cancel-dialog')).toBeVisible()
  await hideDevOverlay(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${P02_SHOT_DIR}/cancel-confirm-build.png`, fullPage: false })
})

test('capture: upcoming days', async ({ page }) => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
  await signIn(page)
  await page.getByTestId('nav-upcoming').click()
  await page.waitForURL('**/dashboard/upcoming**')
  await expect(page.getByTestId('day-strip')).toBeVisible()
  await hideDevOverlay(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${P02_SHOT_DIR}/upcoming-build.png`, fullPage: false })
})

test('capture: drawer with the preparation detail expanded', async ({ page }) => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
  await signIn(page)

  const rows = page.getByTestId(/^booking-row-/)
  const count = await rows.count()
  test.skip(count === 0, 'no bookings today at Town to open')

  // Open the first booking that actually carries preparation.
  for (let index = 0; index < count; index += 1) {
    await rows.nth(index).click()
    if ((await page.getByTestId('prep-strip').count()) > 0) break
    await page.getByTestId('drawer-close').click()
  }
  test.skip(
    (await page.getByTestId('prep-strip').count()) === 0,
    'no booking today needs preparation',
  )

  await page.getByTestId('prep-strip-toggle').click()
  await expect(page.getByTestId('prep-strip-details')).toBeVisible()
  // The drawer body scrolls, and the strip sits near its foot — bring the
  // expanded detail into frame or the capture proves nothing.
  await page.getByTestId('prep-strip-details').scrollIntoViewIfNeeded()
  await hideDevOverlay(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${P02_SHOT_DIR}/drawer-prep-expanded-build.png`, fullPage: false })
})

test('capture: today with the search and filter toolbar', async ({ page }) => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
  await signIn(page)
  await expect(page.getByTestId('bookings-search')).toBeVisible()
  await page.getByTestId('filter-completed').click()
  await expect(page.getByTestId('bookings-count')).toContainText('من')
  await hideDevOverlay(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${P02_SHOT_DIR}/today-filtered-build.png`, fullPage: false })
})

test('capture: prices editor', async ({ page }) => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
  await signInAndGo(page, '/dashboard/services')
  await expect(page.getByTestId('prices-notice')).toBeVisible({ timeout: 60_000 })
  await hideDevOverlay(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: `${P02_SHOT_DIR}/../p03-fidelity/prices-build.png`,
    fullPage: false,
  })
})

test('capture: prices editor with the type-to-confirm dialog', async ({ page }) => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
  await signInAndGo(page, '/dashboard/services')
  await expect(page.getByTestId('prices-notice')).toBeVisible({ timeout: 60_000 })

  const edit = page.getByTestId(/^edit-/).first()
  await edit.click()
  const input = page.getByTestId(/^price-input-/).first()
  const current = Number(await input.inputValue())
  // A change big enough to demand retyping, but inside the server's 10x guard.
  await input.fill(String(current * 3))
  await page
    .getByTestId(/^save-/)
    .first()
    .click()
  await expect(page.getByTestId('price-confirm-dialog')).toBeVisible()
  await hideDevOverlay(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: `${P02_SHOT_DIR}/../p03-fidelity/prices-confirm-build.png`,
    fullPage: false,
  })
})

// ── P05 captures ───────────────────────────────────────────────────────────
// ⚠ NO design-bundle screen exists for this surface — the bundle's "Provider
// Profile" is the PATIENT branch screen (F04). These captures document the
// built screen against the design-system contract; SPEC-P05 records the gap.

const P05_SHOT_DIR = '../../docs/design-briefs/p05-fidelity'

test('capture: branch profile', async ({ page }) => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
  await signInAndGo(page, '/dashboard/profile')
  await expect(page.getByTestId('profile-phone')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('profile-gated')).toBeVisible()
  await hideDevOverlay(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${P05_SHOT_DIR}/profile-build.png`, fullPage: false })
})

test('capture: branch profile with an inline validation error', async ({ page }) => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
  await signInAndGo(page, '/dashboard/profile')
  await expect(page.getByTestId('profile-phone')).toBeVisible({ timeout: 60_000 })
  await page.getByTestId('profile-whatsapp').fill('02-25787202')
  await page.getByTestId('profile-save').click()
  await expect(page.getByRole('alert').filter({ hasText: 'واتساب' })).toBeVisible()
  await hideDevOverlay(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${P05_SHOT_DIR}/profile-error-build.png`, fullPage: false })
})
