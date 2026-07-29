import { expect, test } from '@playwright/test'

// P01 E2E — the reason Playwright has been sitting in CI since SETUP-01.
// Runs against the live dev project with the seeded provider accounts
// (supabase/seeds/003_provider_users.sql).

// Credentials come from the ENVIRONMENT, never from this file. A password
// literal in the repo is a hardcoded secret no matter how "dev-only" it is
// (CLAUDE.md §8) — secret scanning flags it, and rightly so.
//
// Local:  set PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD in apps/web/.env.local
// CI:     add them as repo secrets and wire them into the e2e-web job
//         (see .github/workflows/ci.yml). Until then these tests SKIP rather
//         than fail — a skipped suite is honest, a red one is noise.
const PROVIDER_EMAIL = process.env.PROVIDER_TEST_EMAIL ?? ''
const PROVIDER_PASSWORD = process.env.PROVIDER_TEST_PASSWORD ?? ''
const HAS_CREDS = PROVIDER_EMAIL.length > 0 && PROVIDER_PASSWORD.length > 0

const TOWN_RECEPTION = { email: PROVIDER_EMAIL, password: PROVIDER_PASSWORD }
const NON_PROVIDER = { email: 'patient-not-a-provider@example.com', password: 'not-a-real-account' }

async function login(
  page: import('@playwright/test').Page,
  creds: { email: string; password: string },
) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(creds.email)
  await page.getByTestId('login-password').fill(creds.password)
  await page.getByTestId('login-submit').click()
}

test.describe('provider dashboard — login', () => {
  test('the portal is RTL and Arabic', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('heading', { name: 'بوابة الشركاء' })).toBeVisible()
  })

  test('the submit button stays disabled until the form is plausible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByTestId('login-submit')).toBeDisabled()
    await page.getByTestId('login-email').fill('someone@example.com')
    await page.getByTestId('login-password').fill('x')
    await expect(page.getByTestId('login-submit')).toBeDisabled() // password too short
    await page.getByTestId('login-password').fill('long-enough')
    await expect(page.getByTestId('login-submit')).toBeEnabled()
  })

  test('bad credentials produce a calm Arabic error, never a raw one', async ({ page }) => {
    test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
    await login(page, { email: TOWN_RECEPTION.email, password: 'definitely-wrong' })
    const error = page.getByTestId('login-error')
    await expect(error).toBeVisible()
    await expect(error).toContainText('غير صحيحة')
    // No raw provider string leaks through.
    await expect(error).not.toContainText('Invalid')
  })

  test('a non-provider account is rejected and NOT left signed in', async ({ page }) => {
    await login(page, NON_PROVIDER)
    // Either the credentials do not exist or the role gate rejects them; both
    // must end on /login with an Arabic message and no dashboard access.
    await expect(page.getByTestId('login-error')).toBeVisible()
    await page.goto('/dashboard/today')
    await expect(page).toHaveURL(/\/login/)
  })

  test('signed-out visitors cannot reach the dashboard', async ({ page }) => {
    await page.goto('/dashboard/today')
    await expect(page).toHaveURL(/\/login/)
    // …and are returned to where they were headed after signing in.
    expect(page.url()).toContain('next=%2Fdashboard%2Ftoday')
  })
})

test.describe('provider dashboard — Today view', () => {
  // The whole suite needs a real provider session.
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await login(page, TOWN_RECEPTION)
    await page.waitForURL('**/dashboard/today')
    // Wait for the TABLE, not just the URL. `waitForURL` resolves before the
    // RSC payload paints, so a `rows.count()` straight after it reads 0 and
    // every count-guarded test SKIPS itself — and a skipped suite looks
    // exactly like a passing one in the summary line (§4).
    await expect(page.getByTestId('bookings-list').or(page.getByTestId('today-empty'))).toBeVisible(
      { timeout: 30_000 },
    )
  })

  test('the shell renders the branch, the date and the fill indicator', async ({ page }) => {
    await expect(page.getByTestId('branch-name')).toContainText('تاون')
    await expect(page.getByTestId('fill-indicator')).toBeVisible()
    await expect(page.getByTestId('nav-today')).toBeVisible()
  })

  test('the list is either populated or shows the empty state — never blank', async ({ page }) => {
    // P02 renamed today-list → bookings-list: Today and Upcoming now render the
    // SAME panel, so a Today-specific id would have been a lie.
    const list = page.getByTestId('bookings-list')
    const empty = page.getByTestId('today-empty')
    await expect(list.or(empty)).toBeVisible()
  })

  test('the outcome workflow progresses وصل → تمت الخدمة', async ({ page }) => {
    const rows = page.getByTestId(/^booking-row-/)
    test.skip((await rows.count()) === 0, 'no bookings today at Town — seed one to exercise this')

    // Find a row that still offers the arrive action.
    const arriveButton = page.getByTestId(/^action-arrived-/).first()
    test.skip((await arriveButton.count()) === 0, 'no actionable booking today')

    const bookingId = (await arriveButton.getAttribute('data-testid'))!.replace(
      'action-arrived-',
      '',
    )
    await arriveButton.click()

    // Chip flips to وصل and the action becomes تمت الخدمة — the display
    // predicate following the server's transition table.
    await expect(page.getByTestId(`status-chip-${bookingId}`)).toHaveAttribute(
      'data-status',
      'arrived',
    )
    await expect(page.getByTestId(`action-completed-${bookingId}`)).toBeVisible()

    await page.getByTestId(`action-completed-${bookingId}`).click()
    await expect(page.getByTestId(`status-chip-${bookingId}`)).toHaveAttribute(
      'data-status',
      'completed',
    )
    // Terminal: no action remains.
    await expect(page.getByTestId(`action-completed-${bookingId}`)).toHaveCount(0)
    await expect(page.getByTestId(`action-arrived-${bookingId}`)).toHaveCount(0)
  })

  test('a cash row is unmissable and a prepaid row is quiet', async ({ page }) => {
    const cashRow = page.locator('[data-testid^="payment-"][data-cash="yes"]').first()
    test.skip((await cashRow.count()) === 0, 'no cash booking today')
    await expect(cashRow).toContainText('يدفع هنا')
  })

  test('logging out returns to the portal and locks the dashboard again', async ({ page }) => {
    await page.getByTestId('logout').click()
    await page.waitForURL('**/login')
    await page.goto('/dashboard/today')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('provider dashboard — booking detail drawer (P02)', () => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await login(page, TOWN_RECEPTION)
    await page.waitForURL('**/dashboard/today')
    // Wait for the TABLE, not just the URL. `waitForURL` resolves before the
    // RSC payload paints, so a `rows.count()` straight after it reads 0 and
    // every count-guarded test SKIPS itself — and a skipped suite looks
    // exactly like a passing one in the summary line (§4).
    await expect(page.getByTestId('bookings-list').or(page.getByTestId('today-empty'))).toBeVisible(
      { timeout: 30_000 },
    )
  })

  test('a row opens the drawer and the list stays LIVE behind it', async ({ page }) => {
    const rows = page.getByTestId(/^booking-row-/)
    test.skip((await rows.count()) === 0, 'no bookings today at Town — seed one to exercise this')

    await rows.first().click()
    const drawer = page.getByTestId('booking-drawer')
    await expect(drawer).toBeVisible()
    await expect(page.getByTestId('drawer-ref')).toContainText('IH-')

    // The whole point of a drawer rather than a page: the list is still there,
    // still mounted, still receiving realtime.
    await expect(page.getByTestId('bookings-list')).toBeVisible()
    await expect(rows.first()).toBeVisible()
  })

  test('the drawer closes on ✕ and on Escape', async ({ page }) => {
    const rows = page.getByTestId(/^booking-row-/)
    test.skip((await rows.count()) === 0, 'no bookings today at Town')

    await rows.first().click()
    await page.getByTestId('drawer-close').click()
    await expect(page.getByTestId('booking-drawer')).toBeHidden()

    await rows.first().click()
    await expect(page.getByTestId('booking-drawer')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('booking-drawer')).toBeHidden()
  })

  test('the drawer shows the services, the total and the action history', async ({ page }) => {
    const rows = page.getByTestId(/^booking-row-/)
    test.skip((await rows.count()) === 0, 'no bookings today at Town')

    await rows.first().click()
    await expect(page.getByTestId('drawer-history')).toBeVisible()
    // Every booking has at least its creation entry — derived from created_at,
    // which is never null.
    await expect(page.getByTestId('drawer-history')).toContainText('أنشأ المريض الحجز')
    await expect(page.getByTestId('drawer-payment')).toBeVisible()
  })

  test('cancel-on-behalf asks for confirmation before it does anything', async ({ page }) => {
    const rows = page.getByTestId(/^booking-row-/)
    test.skip((await rows.count()) === 0, 'no bookings today at Town')

    await rows.first().click()
    const cancelButton = page.getByTestId('drawer-cancel')
    test.skip((await cancelButton.count()) === 0, 'the first booking is already closed')

    await cancelButton.click()
    const dialog = page.getByTestId('cancel-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('إلغاء الحجز بالنيابة عن المريض؟')

    // تراجع must leave the booking completely untouched.
    await page.getByTestId('cancel-dialog-dismiss').click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('booking-drawer')).toBeVisible()
  })
})

test.describe('provider dashboard — upcoming days (P02)', () => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await login(page, TOWN_RECEPTION)
    await page.waitForURL('**/dashboard/today')
    await page.getByTestId('nav-upcoming').click()
    await page.waitForURL('**/dashboard/upcoming**')
    await expect(
      page.getByTestId('bookings-list').or(page.getByTestId('upcoming-empty')),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('the date switcher renders the slot window and a selected day', async ({ page }) => {
    await expect(page.getByTestId('day-strip')).toBeVisible()
    const days = page.getByTestId(/^day-\d{4}-\d{2}-\d{2}$/)
    expect(await days.count()).toBeGreaterThan(0)
    await expect(page.getByTestId('upcoming-day-label')).toBeVisible()
  })

  test('switching day changes the URL, so a refresh keeps the desk where it was', async ({
    page,
  }) => {
    const days = page.getByTestId(/^day-\d{4}-\d{2}-\d{2}$/)
    test.skip((await days.count()) < 2, 'fewer than two days in the window')

    const second = days.nth(1)
    const isoDate = (await second.getAttribute('data-testid'))!.replace('day-', '')
    await second.click()
    await page.waitForURL(`**/dashboard/upcoming?date=${isoDate}`)
    await expect(second).toHaveAttribute('aria-pressed', 'true')
  })

  test('a FUTURE day offers no outcome actions — client side matches the RPC', async ({ page }) => {
    const rows = page.getByTestId(/^booking-row-/)
    test.skip((await rows.count()) === 0, 'no bookings on the selected upcoming day')

    // The server returns slot_in_future for these; the UI must never offer them.
    await expect(page.getByTestId(/^action-arrived-/)).toHaveCount(0)
    await expect(page.getByTestId(/^action-completed-/)).toHaveCount(0)
    await expect(page.getByTestId(/^action-no_show-/)).toHaveCount(0)
  })

  test('a future row still opens the drawer, and the drawer offers no outcome either', async ({
    page,
  }) => {
    const rows = page.getByTestId(/^booking-row-/)
    test.skip((await rows.count()) === 0, 'no bookings on the selected upcoming day')

    await rows.first().click()
    await expect(page.getByTestId('booking-drawer')).toBeVisible()
    await expect(page.getByTestId('drawer-action-arrived')).toHaveCount(0)
    // …but cancel-on-behalf IS available: a phone cancellation for tomorrow is
    // exactly the case this feature exists for.
    await expect(page.getByTestId('drawer-cancel')).toBeVisible()
  })

  test('an empty day shows its empty state, never a blank panel', async ({ page }) => {
    const list = page.getByTestId('bookings-list')
    const empty = page.getByTestId('upcoming-empty')
    await expect(list.or(empty)).toBeVisible()
  })
})

test.describe('provider dashboard — search, filter & pagination (P02 follow-up)', () => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await login(page, TOWN_RECEPTION)
    await page.waitForURL('**/dashboard/today')
    await expect(page.getByTestId('bookings-list').or(page.getByTestId('today-empty'))).toBeVisible(
      { timeout: 30_000 },
    )
  })

  test('the status filter narrows the table SERVER-side', async ({ page }) => {
    const rows = page.getByTestId(/^booking-row-/)
    test.skip((await rows.count()) === 0, 'no bookings today at Town')

    await page.getByTestId('filter-completed').click()

    // Every chip on screen must be the one filtered for — proof the DATABASE
    // filtered, not that we hid rows in the browser.
    //
    // Asserted as "no NON-matching chip remains", which RETRIES until the
    // query lands. Reading the chips once raced the round trip and captured
    // the pre-filter DOM — the same trap as a fixed wait, just quieter.
    await expect(
      page.locator('[data-testid^="status-chip-"]:not([data-status="completed"])'),
    ).toHaveCount(0)
    expect(await page.getByTestId(/^booking-row-/).count()).toBeGreaterThan(0)
  })

  test('a search that matches nothing keeps the way back out', async ({ page }) => {
    await page.getByTestId('bookings-search').fill('zzzz-no-such-patient')
    await expect(page.getByTestId('bookings-no-matches')).toBeVisible()
    // The toolbar MUST survive the empty state, or the desk is trapped.
    await expect(page.getByTestId('bookings-search')).toBeVisible()

    await page.getByTestId('bookings-search').fill('')
    await expect(page.getByTestId('bookings-no-matches')).toHaveCount(0)
  })

  test('searching by phone works with Arabic-Indic digits', async ({ page }) => {
    const rows = page.getByTestId(/^booking-row-/)
    const before = await rows.count()
    test.skip(before === 0, 'no bookings today at Town')

    // The desk types Arabic numerals; the phone is stored in Western ones.
    await page.getByTestId('bookings-search').fill('٢٠١٠٠٠٠٠٠٠٠')
    await expect(page.getByTestId('bookings-no-matches')).toHaveCount(0)
    expect(await rows.count()).toBeGreaterThan(0)
  })
})

test.describe('provider dashboard — preparation detail (P02 follow-up)', () => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  test('the drawer reveals the ACTUAL per-service requirement, not just a summary', async ({
    page,
  }) => {
    await login(page, TOWN_RECEPTION)
    await page.waitForURL('**/dashboard/today')
    await expect(page.getByTestId('bookings-list').or(page.getByTestId('today-empty'))).toBeVisible(
      { timeout: 30_000 },
    )

    const rows = page.getByTestId(/^booking-row-/)
    const count = await rows.count()
    test.skip(count === 0, 'no bookings today at Town')

    for (let index = 0; index < count; index += 1) {
      await rows.nth(index).click()
      if ((await page.getByTestId('prep-strip').count()) > 0) break
      await page.getByTestId('drawer-close').click()
    }
    test.skip(
      (await page.getByTestId('prep-strip').count()) === 0,
      'nothing needs preparation today',
    )

    // Collapsed by default; the summary's own copy invites the press.
    await expect(page.getByTestId('prep-strip-details')).toHaveCount(0)
    await page.getByTestId('prep-strip-toggle').click()

    const details = page.getByTestId('prep-strip-details')
    await expect(details).toBeVisible()
    // Not empty: the whole complaint was a summary pointing at nothing.
    expect((await details.innerText()).trim().length).toBeGreaterThan(0)
  })
})

test.describe('provider dashboard — day strip scrolling (P02 follow-up)', () => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  // A NARROW desktop viewport is the case that broke: the strip overflowed,
  // the scrollbar is hidden by design, and a vertical wheel scrolled the page.
  test.use({ viewport: { width: 1100, height: 720 } })

  test('an overflowing strip is scrollable with the arrows', async ({ page }) => {
    await login(page, TOWN_RECEPTION)
    await page.waitForURL('**/dashboard/today')
    await page.getByTestId('nav-upcoming').click()
    await page.waitForURL('**/dashboard/upcoming**')

    const strip = page.getByTestId('day-strip')
    await expect(strip).toBeVisible()

    const overflows = await strip.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    test.skip(!overflows, 'the slot window fits without scrolling at this width')

    await expect(page.getByTestId('day-strip-end')).toBeVisible()
    const before = await strip.evaluate((el) => Math.abs(el.scrollLeft))
    await page.getByTestId('day-strip-end').click()
    await expect.poll(async () => strip.evaluate((el) => Math.abs(el.scrollLeft))).not.toBe(before)
  })
})
