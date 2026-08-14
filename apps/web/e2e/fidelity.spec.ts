import { expect, test, type Page } from '@playwright/test'

import { totp, waitForUsableWindow } from './support/totp'

// Design-fidelity capture. NOT an assertion suite — it exists so any PR
// claiming design fidelity can prove it with comparison screenshots
// (ENGINEERING-WORKFLOW §9). Run it, commit the output, put the images beside
// the design bundle's screens in the PR body.
//
//   pnpm --filter @instahealth/web exec playwright test fidelity --update-snapshots
//
// 1366×768 is the desktop FLOOR from the DESIGN-02 brief ("old office
// machines") — capture at the floor, because that is where layouts break.
//
// ⚠ THE ADMIN HALF NEEDS AN aal2 SESSION, AND GETS ONE BY LOGGING IN. For four
// features this file had no admin captures at all, for exactly one reason: it
// could not reach the admin portal, whose gate requires a TOTP factor. The
// answer is NOT a bypass — it is an authenticator. `supabase/seeds/007` seeds a
// dedicated dev-only admin with a known TOTP secret, and the block at the foot
// of this file computes the current six digits and types them into the real
// form, like a human reading a phone. Nothing in the gate knows this suite
// exists. See §9 and the seed's header before changing any of it.

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
  // Errors surface WHILE TYPING and disable save (Branch Details design) —
  // no click needed, and none possible: the button is disabled.
  await page.getByTestId('profile-whatsapp').fill('15276')
  await expect(page.getByRole('alert').filter({ hasText: 'موبايل' })).toBeVisible()
  await expect(page.getByTestId('profile-save')).toBeDisabled()
  await hideDevOverlay(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${P05_SHOT_DIR}/profile-error-build.png`, fullPage: false })
})

// ══════════════════════════════════════════════════════════════════════════
// A04–A07 captures — the admin portal
// ══════════════════════════════════════════════════════════════════════════
//
// Compare against, in `design/handoff/project/`:
//   Admin - Service Catalog.dc.html     → a04-fidelity/
//   Admin - Staff Accounts.dc.html      → a05-fidelity/
//   Admin - Bookings Oversight.dc.html  → a06-fidelity/
//   Admin - Ops Overview.dc.html        → a07-fidelity/
//
// ⚠ REQUIRES TWO SEEDS, and says so LOUDLY rather than skipping:
//   supabase/seeds/007_admin_fidelity_account.sql   the admin + its authenticator
//   supabase/seeds/008_fidelity_fixtures.sql        the draft service the
//                                                   publish confirm needs
// A skipped capture and a captured screen look identical in a summary line
// (§9), and that is precisely how four features shipped with no admin captures
// at all — so a missing fixture FAILS here.

const FIDELITY_EMAIL = process.env.FIDELITY_ADMIN_EMAIL ?? ''
const FIDELITY_PASSWORD = process.env.FIDELITY_ADMIN_PASSWORD ?? ''
const FIDELITY_TOTP_SECRET = process.env.FIDELITY_ADMIN_TOTP_SECRET ?? ''
const HAS_ADMIN_CREDS =
  FIDELITY_EMAIL.length > 0 && FIDELITY_PASSWORD.length > 0 && FIDELITY_TOTP_SECRET.length > 0

// ⚠ TRIPWIRES, not niceties — the same discipline as `admin.spec.ts`, for the
// same reason and one more.
//   · admin@instahealth.eg      is the FOUNDER's account.
//   · admin-e2e@instahealth.eg  is the account `admin.spec.ts` RESETS to a
//     pristine first-login state on every run. Pointing this harness there
//     means one suite deleting the authenticator the other needs, and whichever
//     ran second would fail for a reason naming neither.
const FORBIDDEN_ADMINS = ['admin@instahealth.eg', 'admin-e2e@instahealth.eg']

const A04_SHOT_DIR = '../../docs/design-briefs/a04-fidelity'
const A05_SHOT_DIR = '../../docs/design-briefs/a05-fidelity'
const A06_SHOT_DIR = '../../docs/design-briefs/a06-fidelity'
const A07_SHOT_DIR = '../../docs/design-briefs/a07-fidelity'
const LOADING_SHOT_DIR = '../../docs/design-briefs/loading-fidelity'

/** The REAL login, driven exactly as a person drives it: password, then the six
 *  digits an authenticator would be showing right now. No bypass, no test-only
 *  branch, nothing in the app aware this is a test. */
async function signInAsFidelityAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login')
  await page.getByTestId('admin-email').fill(FIDELITY_EMAIL)
  await page.getByTestId('admin-password').fill(FIDELITY_PASSWORD)
  await page.getByTestId('admin-login-submit').click()

  // ⚠ ASSERT THE SIGN-IN rather than waiting for where it should land. When the
  // password does not match what seed 007 hashed, every capture below dies as
  // `Test timeout` pointing at a line about the TOTP screen — which names
  // neither the credential nor the seed. admin.spec.ts learned this the
  // expensive way; the lesson transfers verbatim.
  const loginError = page.getByTestId('admin-login-error')
  await expect
    .poll(async () => (await loginError.isVisible()) || page.url().includes('/admin/login/'), {
      timeout: 20_000,
      message: 'admin sign-in neither errored nor navigated',
    })
    .toBeTruthy()
  if (await loginError.isVisible()) {
    throw new Error(
      `Fidelity admin sign-in was REFUSED: "${await loginError.innerText()}". ` +
        'Run supabase/seeds/007_admin_fidelity_account.sql with FIDELITY_ADMIN_PASSWORD ' +
        'set to the value in apps/web/.env.local.',
    )
  }

  // The gate must land on the TOTP step, not the change-password or enrollment
  // screens. Landing anywhere else means seed 007's two flags are wrong, and
  // saying so here beats a timeout on a testid that will never appear.
  await page.waitForURL('**/admin/login/verify', { timeout: 20_000 })

  // Only wait when the current 30s step is nearly over — a code that expires
  // between the fill and the round trip is refused, and the message blames the
  // code rather than the clock.
  await waitForUsableWindow()
  await page.getByTestId('admin-totp-input').fill(totp(FIDELITY_TOTP_SECRET))
  await page.getByTestId('admin-verify-submit').click()

  const verifyError = page.getByTestId('admin-verify-error')
  await expect
    .poll(async () => (await verifyError.isVisible()) || page.url().includes('/admin/overview'), {
      timeout: 30_000,
      message: 'TOTP verify neither errored nor navigated',
    })
    .toBeTruthy()
  if (await verifyError.isVisible()) {
    throw new Error(
      `TOTP was REFUSED: "${await verifyError.innerText()}". FIDELITY_ADMIN_TOTP_SECRET does ` +
        'not match the factor seed 007 wrote, or this machine clock has drifted.',
    )
  }
  await expect(page.getByTestId('admin-shell')).toBeVisible({ timeout: 30_000 })
}

/** Fonts settled + the dev-tools disc hidden, then shoot. Every capture wants
 *  both, and forgetting either is invisible until someone opens the image. */
async function shoot(page: Page, path: string): Promise<void> {
  await hideDevOverlay(page)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path, fullPage: false })
}

test.describe('admin portal fidelity (A04–A07)', () => {
  // ⚠ SERIAL, AND ONE LOGIN FOR THE WHOLE BLOCK. Supabase refuses a REPLAYED
  // TOTP code, so N captures each signing in would need N distinct 30-second
  // windows — thirteen captures, six and a half minutes of pure waiting, and a
  // parallel worker would collide with its sibling inside one window anyway.
  // One session, reused, is both faster and the only version that is correct.
  test.describe.configure({ mode: 'serial' })

  test.skip(
    !HAS_ADMIN_CREDS,
    'FIDELITY_ADMIN_EMAIL / FIDELITY_ADMIN_PASSWORD / FIDELITY_ADMIN_TOTP_SECRET not set — ' +
      'see supabase/seeds/007_admin_fidelity_account.sql',
  )

  let page: Page

  test.beforeAll(async ({ browser }) => {
    if (FORBIDDEN_ADMINS.includes(FIDELITY_EMAIL.trim().toLowerCase())) {
      throw new Error(
        `REFUSING TO RUN: FIDELITY_ADMIN_EMAIL is ${FIDELITY_EMAIL}. That is either the ` +
          'founder account or the one admin.spec.ts resets on every run. Point it at ' +
          'admin-fidelity@instahealth.eg (supabase/seeds/007).',
      )
    }
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    page = await context.newPage()
    await signInAsFidelityAdmin(page)
  })

  test.afterAll(async () => {
    await page?.context().close()
  })

  // ── A04 · Admin - Service Catalog ────────────────────────────────────────

  test('A04 capture: the catalog list', async () => {
    await page.goto('/admin/catalog')
    await expect(page.getByTestId('catalog-table')).toBeVisible({ timeout: 60_000 })
    await shoot(page, `${A04_SHOT_DIR}/catalog-list-build.png`)
  })

  test('A04 capture: the service detail, with its branch price table', async () => {
    await page.goto('/admin/catalog')
    await expect(page.getByTestId('catalog-table')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('catalog-row').first().click()
    await expect(page.getByTestId('admin-catalog-detail')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('catalog-price-table')).toBeVisible()
    await shoot(page, `${A04_SHOT_DIR}/catalog-detail-build.png`)
  })

  test('A04 capture: the PUBLISH confirm', async () => {
    // Needs a service that is not already published — every real one is, so
    // seed 008 provides a draft that no patient can see (`is_active` is
    // GENERATED from `status`). Fail loudly if it is absent: a silent skip here
    // is how this capture went unmade four times.
    await page.goto('/admin/catalog')
    await expect(page.getByTestId('catalog-table')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('catalog-search').fill('لقطات')
    const draft = page.getByTestId('catalog-row').first()
    await expect(
      draft,
      'seed 008_fidelity_fixtures.sql has not been run — no draft service to publish',
    ).toBeVisible({ timeout: 30_000 })
    await draft.click()
    await expect(page.getByTestId('admin-catalog-detail')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('catalog-status-change').first().click()
    await expect(page.getByTestId('catalog-status-confirm')).toBeVisible({ timeout: 60_000 })
    await shoot(page, `${A04_SHOT_DIR}/catalog-publish-confirm-build.png`)
  })

  test('A04 capture: the SUSPEND confirm', async () => {
    await page.goto('/admin/catalog')
    await expect(page.getByTestId('catalog-table')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('catalog-row').first().click()
    await expect(page.getByTestId('admin-catalog-detail')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('catalog-status-change').first().click()
    await expect(page.getByTestId('catalog-status-confirm')).toBeVisible({ timeout: 60_000 })
    await shoot(page, `${A04_SHOT_DIR}/catalog-suspend-confirm-build.png`)
  })

  test('A04 capture: the CATEGORY flip confirm — «THE launch switch»', async () => {
    await page.goto('/admin/catalog')
    await expect(page.getByTestId('catalog-categories')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('catalog-category-toggle').first().click()
    await expect(page.getByTestId('catalog-category-confirm')).toBeVisible({ timeout: 60_000 })
    await shoot(page, `${A04_SHOT_DIR}/catalog-category-confirm-build.png`)
  })

  test('A04 capture: the confirm dialog while its numbers are still in flight', async () => {
    // ⚠ THE LOADING STATE IS A LATENCY WINDOW, so it is REPRODUCED rather than
    // raced for (§9: "reproduce a latency window; do not widen a timeout to
    // hide it"). The dialog numbers come from a server round trip triggered by
    // a `router.replace`; delaying that request makes the state the design
    // draws deterministic instead of a coin flip on a fast laptop.
    await page.goto('/admin/catalog')
    await expect(page.getByTestId('catalog-categories')).toBeVisible({ timeout: 60_000 })

    // ⚠ `times: 1`, AND THE DELAYED REQUEST IS ALLOWED TO FINISH BEFORE THIS
    // TEST ENDS. The first version screenshotted the loading dialog and
    // returned immediately, leaving a 6-second navigation in flight. It landed
    // during the NEXT capture — the A05 staff test then sat forever on
    // `staff-disable-confirm` and failed with `element(s) not found`, a message
    // about the staff screen produced entirely by the catalog screen. Two
    // captures in this block share ONE page, so a test does not own the page
    // only until its last assertion; it owns it until nothing it started is
    // still running. Waiting for the resolved dialog is what makes that true.
    await page.route(
      '**/admin/catalog?*',
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 6_000))
        await route.continue()
      },
      { times: 1 },
    )
    try {
      await page.getByTestId('catalog-category-toggle').first().click()
      await expect(page.getByTestId('catalog-category-confirm-loading')).toBeVisible({
        timeout: 30_000,
      })
      await shoot(page, `${A04_SHOT_DIR}/catalog-confirm-loading-build.png`)
      // Let the window close on its own terms: the loading dialog must become
      // the real one before this test hands the page over.
      await expect(page.getByTestId('catalog-category-confirm')).toBeVisible({ timeout: 60_000 })
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' })
    }
  })

  // ── A05 · Admin - Staff Accounts ─────────────────────────────────────────

  test('A05 capture: the accounts list', async () => {
    await page.goto('/admin/staff')
    await expect(page.getByTestId('staff-table')).toBeVisible({ timeout: 60_000 })
    await shoot(page, `${A05_SHOT_DIR}/staff-list-build.png`)
  })

  test('A05 capture: create, step 1 — the form', async () => {
    await page.goto('/admin/staff')
    await expect(page.getByTestId('staff-table')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('staff-new').click()
    await expect(page.getByTestId('staff-create-dialog')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('staff-create-name').fill('منى عبد الرحمن')
    await page.getByTestId('staff-create-email').fill('mona.fidelity@example.eg')
    await shoot(page, `${A05_SHOT_DIR}/staff-create-step1-build.png`)
  })

  test('A05 capture: the account detail, with its audit trail', async () => {
    await page.goto('/admin/staff')
    await expect(page.getByTestId('staff-table')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('staff-row').first().click()
    await expect(page.getByTestId('admin-staff-detail')).toBeVisible({ timeout: 60_000 })
    await shoot(page, `${A05_SHOT_DIR}/staff-detail-build.png`)
  })

  test('A05 capture: BOTH disable confirms — ordinary, and the last active account', async () => {
    // ⚠ WHICH VARIANT RENDERS IS THE SERVER ANSWER, NOT THIS TEST GUESS.
    // `isLastActiveAccount` comes from `preview_staff_disable`, so the harness
    // opens the confirm for every account and files each capture under whatever
    // the server decided — the same law as §1.4, applied to a screenshot.
    await page.goto('/admin/staff')
    await expect(page.getByTestId('staff-table')).toBeVisible({ timeout: 60_000 })
    const total = await page.getByTestId('staff-row').count()

    const captured = new Set<string>()
    for (let index = 0; index < total && captured.size < 2; index += 1) {
      await page.goto('/admin/staff')
      await expect(page.getByTestId('staff-table')).toBeVisible({ timeout: 60_000 })
      await page.getByTestId('staff-row').nth(index).click()
      await expect(page.getByTestId('admin-staff-detail')).toBeVisible({ timeout: 60_000 })
      if ((await page.getByTestId('staff-disable').count()) === 0) continue

      await page.getByTestId('staff-disable').click()
      await expect(page.getByTestId('staff-disable-confirm')).toBeVisible({ timeout: 60_000 })

      // The escalated variant is the one carrying the warning banner.
      const escalated = (await page.getByTestId('staff-disable-confirm-banner').count()) > 0
      const variant = escalated ? 'last-active' : 'ordinary'
      if (captured.has(variant)) continue
      captured.add(variant)
      await shoot(page, `${A05_SHOT_DIR}/staff-disable-${variant}-build.png`)
    }

    expect(
      [...captured].sort(),
      'both disable variants must be captured — dev has one branch with 2 active accounts ' +
        '(ordinary) and one with 1 (escalated); if this fails the data changed',
    ).toEqual(['last-active', 'ordinary'])
  })

  // ── A06 · Admin - Bookings Oversight ─────────────────────────────────────

  test('A06 capture: the oversight list', async () => {
    await page.goto('/admin/bookings')
    await expect(page.getByTestId('oversight-table')).toBeVisible({ timeout: 60_000 })
    await shoot(page, `${A06_SHOT_DIR}/oversight-list-build.png`)
  })

  test('A06 capture: the drawer and its money block', async () => {
    await page.goto('/admin/bookings')
    await expect(page.getByTestId('oversight-table')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('oversight-row').first().click()
    await expect(page.getByTestId('oversight-drawer')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('oversight-money')).toBeVisible()
    await shoot(page, `${A06_SHOT_DIR}/oversight-drawer-build.png`)
  })

  test('A06 capture: the admin cancel confirm', async () => {
    await page.goto('/admin/bookings')
    await expect(page.getByTestId('oversight-table')).toBeVisible({ timeout: 60_000 })
    const rows = page.getByTestId('oversight-row')
    const total = await rows.count()
    let opened = false
    for (let index = 0; index < total; index += 1) {
      await rows.nth(index).click()
      await expect(page.getByTestId('oversight-drawer')).toBeVisible({ timeout: 60_000 })
      if ((await page.getByTestId('oversight-cancel').count()) > 0) {
        opened = true
        break
      }
      await page.getByTestId('oversight-drawer-close').click()
    }
    expect(opened, 'no cancellable booking in the oversight list — reseed 004').toBe(true)

    await page.getByTestId('oversight-cancel').click()
    await expect(page.getByTestId('oversight-cancel-confirm')).toBeVisible({ timeout: 60_000 })
    await shoot(page, `${A06_SHOT_DIR}/oversight-cancel-confirm-build.png`)
  })

  test('A06 capture: a reference nobody holds — the not-found guidance', async () => {
    await page.goto('/admin/bookings')
    await expect(page.getByTestId('oversight-table')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('oversight-search').fill('IH-0000-00000')
    await page.getByTestId('oversight-search-submit').click()
    await expect(page.getByTestId('oversight-empty')).toBeVisible({ timeout: 60_000 })
    await shoot(page, `${A06_SHOT_DIR}/oversight-not-found-build.png`)
  })

  // ── A07 · Admin - Ops Overview ───────────────────────────────────────────

  test('A07 capture: the overview as it stands today', async () => {
    await page.goto('/admin/overview')
    await expect(page.getByTestId('admin-overview')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('overview-attention')).toBeVisible()
    // Which of the two the panel is showing is a FACT ABOUT TODAY, not a choice
    // — record it in the filename so the PR body cannot mislabel the capture.
    const healthy = (await page.getByTestId('overview-healthy').count()) > 0
    await shoot(page, `${A07_SHOT_DIR}/overview-${healthy ? 'healthy' : 'with-alerts'}-build.png`)
  })

  // ── The admin portal's loading states ────────────────────────────────────
  // Seven `force-dynamic` screens had NO `loading.tsx` at all, so every
  // navigation sat on the previous screen until the server answered. These
  // capture the skeletons that now cover that window.
  //
  // ⚠ A LOADING STATE IS A LATENCY WINDOW: it is REPRODUCED, never raced for
  // (§9). The RSC payload for the target route is delayed on purpose so the
  // skeleton is deterministic rather than a coin flip on a fast laptop.
  //
  // ⚠ AND THE DELAYED REQUEST IS ALLOWED TO LAND BEFORE EACH TEST RETURNS —
  // these captures share ONE page with everything above, and the A04 lesson is
  // that a capture owns the page until nothing it started is still running.
  const LOADING_ROUTES = [
    { path: '/admin/overview', settled: 'admin-overview' },
    { path: '/admin/bookings', settled: 'oversight-table' },
    { path: '/admin/catalog', settled: 'catalog-table' },
    { path: '/admin/staff', settled: 'admin-staff' },
    { path: '/admin/providers', settled: 'admin-network' },
    { path: '/admin/commissions', settled: 'admin-header' },
    // ⚠ NO `/admin/analytics`. It carries `force-dynamic` but awaits NOTHING —
    // it is a static «قريباً» page — so it has no loading window to capture.
    // The first pass gave it a `loading.tsx` anyway and the capture came back
    // showing the fully loaded screen under a filename claiming otherwise. A
    // skeleton for a screen that never waits is a lie in both directions.
  ] as const

  for (const route of LOADING_ROUTES) {
    const name = route.path.split('/').pop() as string
    test(`loading capture: ${name} while its data is still in flight`, async () => {
      // Start somewhere else so the navigation is a real client-side one.
      await page.goto('/admin/overview')
      await expect(page.getByTestId('admin-header')).toBeVisible({ timeout: 60_000 })

      await page.route(
        `**${route.path}*`,
        async (r) => {
          await new Promise((resolve) => setTimeout(resolve, 6_000))
          await r.continue()
        },
        { times: 1 },
      )
      try {
        await page.goto(route.path, { waitUntil: 'commit' })
        await expect(page.getByTestId('admin-loading')).toBeVisible({ timeout: 30_000 })
        await shoot(page, `${LOADING_SHOT_DIR}/${name}-loading-build.png`)
        // Hand the page over only once the real screen has replaced the shell.
        await expect(page.getByTestId(route.settled)).toBeVisible({ timeout: 60_000 })
      } finally {
        await page.unrouteAll({ behavior: 'ignoreErrors' })
      }
    })
  }
})
