import { expect, test, type Page } from '@playwright/test'

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

  test('the ROOT sends a signed-in provider straight to Today', async ({ page }) => {
    test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
    await login(page, TOWN_RECEPTION)
    await page.waitForURL('**/dashboard/today')

    // The root is a signpost now, not SETUP-01's scaffold page.
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard\/today/)
  })

  test('a rejected session is NOT bounced back into the dashboard', async ({ page }) => {
    test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')
    await login(page, TOWN_RECEPTION)
    await page.waitForURL('**/dashboard/today')

    // Middleware normally sends a signed-in visitor from /login to the
    // dashboard. With `rejected=1` it must NOT — that bounce is what made the
    // rejection path an infinite loop for a session that is not staff.
    await page.goto('/login?rejected=1')
    await expect(page).toHaveURL(/rejected=1/)
    await expect(page.getByTestId('login-rejected')).toBeVisible()
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

  // ⚠ THE FIXTURE TRIPWIRE. Everything below guards itself with
  // `test.skip(rows.count() === 0)`, which is right for an empty day but means
  // an EXHAUSTED day turns nine tests green-by-absence. That is exactly what
  // happened: the suite mutates the data it tests, the day drained, and for two
  // days CI reported "24 passed, 9 skipped" while the outcome workflow was not
  // being exercised at all — which is how a real bug hid in plain sight.
  //
  // This test does NOT skip. If it is red, the fixtures need reseeding
  // (`supabase/seeds/004_dashboard_e2e_fixtures.sql`) — nothing is wrong with
  // the product. One loud failure beats nine quiet skips.
  //
  // ⚠ IT COUNTS WHAT THE SUITE ACTUALLY CONSUMES, not merely "more than zero".
  // A threshold of 1 is worthless: it passed while the two regression tests
  // below skipped for want of a fixture, which is the same green-by-absence
  // this tripwire exists to prevent — caught on this PR's own first CI run.
  // THREE tests each consume one actionable booking today:
  //   · the outcome workflow progresses وصل → تمت الخدمة
  //   · a completion survives a SLOW round trip
  //   · a rapid double-click writes ONCE
  // Adding another consumer means raising this number AND seeding another row.
  const ACTIONABLE_BOOKINGS_THE_SUITE_CONSUMES = 3

  test('FIXTURE TRIPWIRE — today has enough actionable bookings for the suite', async ({
    page,
  }) => {
    const reseed =
      'Re-run supabase/seeds/004_dashboard_e2e_fixtures.sql (it RESETS the day). This is a test-data problem, not a product failure. In CI it means the SUPABASE_DB_URL secret is missing, so the seed step was skipped.'
    expect(
      await page.getByTestId(/^booking-row-/).count(),
      `No bookings today at Town — the suite CONSUMES its fixtures and the day has drained. ${reseed}`,
    ).toBeGreaterThan(0)
    expect(
      await page.getByTestId(/^action-arrived-/).count(),
      `Today needs ${ACTIONABLE_BOOKINGS_THE_SUITE_CONSUMES} still-actionable bookings; the tests that follow each consume one and would otherwise SKIP THEMSELVES silently. ${reseed}`,
    ).toBeGreaterThanOrEqual(ACTIONABLE_BOOKINGS_THE_SUITE_CONSUMES)
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
    // NOT a skip. These are the regression guards for a lost cash payment — if
    // one cannot run, that must be RED, not silently green. The FIXTURE
    // TRIPWIRE above guarantees the fixtures; this asserts rather than trusts.
    await expect(arriveButton, 'no actionable booking today — reseed 004').toBeVisible()

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

    // ⚠ AND IT STAYS TERMINAL ACROSS NAVIGATION — the founder's report.
    //
    // Next serves back/forward (and, in a PRODUCTION build, ordinary in-app
    // navigation) from the client Router Cache. `export const dynamic =
    // 'force-dynamic'` only stops SERVER caching, so the page remounted from the
    // PRE-ACTION snapshot: the chip read «مؤكد» again and «وصل» came back on a
    // booking the database considered completed. Measured on a production build:
    // stale for the full 10s sample with ZERO refetches — it never self-corrected;
    // only a hard reload cleared it. `next dev` hides this completely, which is
    // why it has to be asserted rather than eyeballed locally.
    //
    // Costs no extra fixture on purpose: it rides the booking this test already
    // consumed, so the FIXTURE TRIPWIRE count stays at 3.
    await page.getByTestId('nav-upcoming').click()
    await page.waitForURL('**/dashboard/upcoming**')
    await expect(
      page.getByTestId('bookings-list').or(page.getByTestId('upcoming-empty')),
    ).toBeVisible({ timeout: 30_000 })

    // ⚠ THESE ASSERTIONS ONLY HAVE TEETH ON A PRODUCTION BUILD.
    //
    // `next dev` refetches the RSC payload on navigation, so the bug cannot
    // occur there and this whole block passes with OR without the fix. Verified
    // both ways: `E2E_PROD=1` + fix reverted fails with
    // `Expected "completed", Received "confirmed"` after 62 retries; the same
    // run under `pnpm dev` passes. CI still runs `pnpm dev`, so treat this as
    // documentation-plus-local-guard until the refactor branch switches CI over.
    //
    // Run it for real with:  E2E_PROD=1 pnpm --filter @instahealth/web test:e2e
    //
    // Counting the revalidation was tried as an environment-independent proxy
    // and does NOT work: an incidental trigger (the focus listener) satisfies it
    // in dev even with the fix removed. Left in only as a weak signal.
    let revalidations = 0
    page.on('request', (request) => {
      if (request.url().includes('get_branch_bookings_for_date')) revalidations += 1
    })

    await page.goBack()
    await page.waitForURL('**/dashboard/today**')
    await expect(page.getByTestId('bookings-list')).toBeVisible({ timeout: 30_000 })

    // Web-first assertions: the revalidation may take a moment, but it must
    // HAPPEN. On a production build these stayed stale indefinitely without it.
    await expect(page.getByTestId(`status-chip-${bookingId}`)).toHaveAttribute(
      'data-status',
      'completed',
      { timeout: 30_000 },
    )
    await expect(page.getByTestId(`action-arrived-${bookingId}`)).toHaveCount(0)
    await expect(page.getByTestId(`action-completed-${bookingId}`)).toHaveCount(0)
    expect(
      revalidations,
      'coming back to Today must re-ask the database — without it a production build keeps painting the pre-action snapshot (weak signal in dev; see the note above)',
    ).toBeGreaterThan(0)
  })

  // ── The swallowed-completion regression ────────────────────────────────────
  //
  // This class of bug is INVISIBLE at localhost latency: every one of these
  // assertions passed locally while failing 2/2 in CI. Rather than tune a
  // timeout to the slower machine — the P03 session established that budgets
  // tuned to one machine are the disease — the test MANUFACTURES the window by
  // delaying the RPC round trips, so a runner is no longer required to find it.
  //
  // What went wrong: a read that started BEFORE the write was still the newest
  // request by sequence number, so its pre-write answer painted over the
  // optimistic one. The row regressed to `confirmed`, the action button's
  // identity is derived from the status, so «تمت الخدمة» silently became «وصل»
  // again — and the desk's click sent `arrived` a second time. The server
  // answered `unchanged: true`, a SUCCESS, so nothing surfaced. For a cash
  // booking that completion IS the payment event.
  const withSlowRpc = async (page: Page, delayMs: number, log: string[]) => {
    await page.route('**/rest/v1/rpc/**', async (route) => {
      const url = route.request().url()
      if (url.includes('mark_booking_outcome')) log.push(route.request().postData() ?? '')
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      await route.continue()
    })
  }

  test('a completion survives a SLOW round trip — the click cannot be swallowed', async ({
    page,
  }) => {
    const outcomeCalls: string[] = []
    await withSlowRpc(page, 700, outcomeCalls)
    await page.reload()
    await expect(page.getByTestId('bookings-list').or(page.getByTestId('today-empty'))).toBeVisible(
      {
        timeout: 30_000,
      },
    )

    const arriveButton = page.getByTestId(/^action-arrived-/).first()
    // NOT a skip. These are the regression guards for a lost cash payment — if
    // one cannot run, that must be RED, not silently green. The FIXTURE
    // TRIPWIRE above guarantees the fixtures; this asserts rather than trusts.
    await expect(arriveButton, 'no actionable booking today — reseed 004').toBeVisible()
    const bookingId = (await arriveButton.getAttribute('data-testid'))!.replace(
      'action-arrived-',
      '',
    )

    await arriveButton.click()

    // The row may NOT claim an outcome the server has not confirmed, so the chip
    // stays put while the write is in the air. What moves is the pending state.
    const completeButton = page.getByTestId(`action-completed-${bookingId}`)
    await expect(completeButton).toBeVisible({ timeout: 30_000 })
    await expect(completeButton).toBeEnabled({ timeout: 30_000 })
    // Enabled means the CONFIRMING refetch has already painted — so the action
    // now on screen is server-confirmed truth, not a guess that can be revoked.
    await expect(page.getByTestId(`status-chip-${bookingId}`)).toHaveAttribute(
      'data-status',
      'arrived',
    )

    await completeButton.click()
    await expect(page.getByTestId(`status-chip-${bookingId}`)).toHaveAttribute(
      'data-status',
      'completed',
      { timeout: 30_000 },
    )

    // The point of the whole test: the SECOND call carried `completed`. Before
    // the fix it carried `arrived` again, and the chip never moved.
    expect(outcomeCalls.filter((body) => body.includes('"p_outcome":"completed"'))).toHaveLength(1)
  })

  test('a rapid double-click writes ONCE and shows no error', async ({ page }) => {
    const outcomeCalls: string[] = []
    await withSlowRpc(page, 700, outcomeCalls)
    await page.reload()
    await expect(page.getByTestId('bookings-list').or(page.getByTestId('today-empty'))).toBeVisible(
      {
        timeout: 30_000,
      },
    )

    const arriveButton = page.getByTestId(/^action-arrived-/).first()
    // NOT a skip. These are the regression guards for a lost cash payment — if
    // one cannot run, that must be RED, not silently green. The FIXTURE
    // TRIPWIRE above guarantees the fixtures; this asserts rather than trusts.
    await expect(arriveButton, 'no actionable booking today — reseed 004').toBeVisible()
    const bookingId = (await arriveButton.getAttribute('data-testid'))!.replace(
      'action-arrived-',
      '',
    )

    // An impatient desk. The guard is a REF, so it holds synchronously — a
    // state-based check loses this race because React has not re-rendered yet.
    await arriveButton.click()
    await arriveButton.click({ force: true }).catch(() => {})
    await arriveButton.click({ force: true }).catch(() => {})

    await expect(page.getByTestId(`status-chip-${bookingId}`)).toHaveAttribute(
      'data-status',
      'arrived',
      { timeout: 30_000 },
    )
    expect(outcomeCalls).toHaveLength(1)
    // A no-op is not an error — the desk must see nothing at all.
    await expect(page.getByTestId('error-toast')).toHaveCount(0)
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

    // Pick a CANCELLABLE row, not blindly the first one. `rows.first()` made
    // this test a hostage to row order: the outcome tests run earlier and
    // consume the earliest rows, so the first row is routinely already closed
    // and the test skipped itself. Selecting by the predicate it actually needs
    // is what makes it independent of what ran before it.
    const cancellable = rows.filter({
      has: page.locator(
        '[data-testid^="status-chip-"][data-status="confirmed"], [data-testid^="status-chip-"][data-status="arrived"]',
      ),
    })
    test.skip(
      (await cancellable.count()) === 0,
      'every booking today is already closed — reseed 004_dashboard_e2e_fixtures.sql',
    )
    await cancellable.first().click()
    const cancelButton = page.getByTestId('drawer-cancel')
    await expect(cancelButton).toBeVisible()

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

test.describe('provider dashboard — prices editor (P03)', () => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  test.beforeEach(async ({ page }) => {
    await login(page, TOWN_RECEPTION)
    await page.waitForURL('**/dashboard/today')
    await page.getByTestId('nav-services').click()
    await page.waitForURL('**/dashboard/services')
    await expect(page.getByTestId('prices-notice')).toBeVisible({ timeout: 30_000 })
  })

  test('the money contract is stated to the person changing prices', async ({ page }) => {
    await expect(page.getByTestId('prices-notice')).toContainText('تحتفظ بسعرها القديم')
  })

  test('the catalogue cannot be extended from here — that is admin-owned', async ({ page }) => {
    await expect(page.getByRole('button', { name: /إضافة خدمة/ })).toBeDisabled()
  })

  test('a small edit saves inline and stamps آخر تحديث', async ({ page }) => {
    const edit = page.getByTestId(/^edit-/).first()
    await edit.click()

    const input = page.getByTestId(/^price-input-/).first()
    const serviceId = (await input.getAttribute('data-testid'))!.replace('price-input-', '')
    const original = Number(await input.inputValue())

    // +10 EGP: under the design's confirm threshold, so it commits directly.
    await input.fill(String(original + 10))
    await page.getByTestId(`save-${serviceId}`).click()

    await expect(page.getByTestId('prices-saved')).toBeVisible()
    await expect(page.getByTestId(`price-${serviceId}`)).toBeVisible()
    // Never-edited rows read «لم يُحدَّث بعد»; this one must not.
    await expect(page.getByTestId(`updated-${serviceId}`)).not.toContainText('لم يُحدَّث بعد')

    // Put it back so the suite is repeatable.
    await page.getByTestId(`edit-${serviceId}`).click()
    await page.getByTestId(`price-input-${serviceId}`).fill(String(original))
    await page.getByTestId(`save-${serviceId}`).click()
    await expect(page.getByTestId('prices-saved')).toBeVisible()
  })

  test('a BIG change demands the price be retyped', async ({ page }) => {
    const edit = page.getByTestId(/^edit-/).first()
    await edit.click()
    const input = page.getByTestId(/^price-input-/).first()
    const serviceId = (await input.getAttribute('data-testid'))!.replace('price-input-', '')
    const original = Number(await input.inputValue())

    await input.fill(String(original * 3))
    await page.getByTestId(`save-${serviceId}`).click()

    const dialog = page.getByTestId('price-confirm-dialog')
    await expect(dialog).toBeVisible()

    // Confirm stays disabled until the typed number matches exactly.
    await expect(page.getByTestId('price-confirm-save')).toBeDisabled()
    await page.getByTestId('price-confirm-input').fill(String(original * 3 + 1))
    await expect(page.getByTestId('price-confirm-save')).toBeDisabled()
    await page.getByTestId('price-confirm-input').fill(String(original * 3))
    await expect(page.getByTestId('price-confirm-save')).toBeEnabled()

    // Back out — this test proves the GUARD, and must not move a real price.
    await page.getByTestId('price-confirm-dismiss').click()
    await expect(dialog).toBeHidden()
  })

  test('the save button stays disabled for an unchanged or invalid price', async ({ page }) => {
    const edit = page.getByTestId(/^edit-/).first()
    await edit.click()
    const input = page.getByTestId(/^price-input-/).first()
    const serviceId = (await input.getAttribute('data-testid'))!.replace('price-input-', '')

    // Unchanged.
    await expect(page.getByTestId(`save-${serviceId}`)).toBeDisabled()
    // Zero is out of bounds — free is modelled by unavailable, not by 0.
    await input.fill('0')
    await expect(page.getByTestId(`save-${serviceId}`)).toBeDisabled()
    // Empty.
    await input.fill('')
    await expect(page.getByTestId(`save-${serviceId}`)).toBeDisabled()
  })

  test('availability toggles and survives a reload', async ({ page }) => {
    const toggle = page.getByTestId(/^toggle-/).first()
    const serviceId = (await toggle.getAttribute('data-testid'))!.replace('toggle-', '')
    const before = await toggle.getAttribute('aria-checked')

    await toggle.click()
    await expect(page.getByTestId('prices-saved')).toBeVisible()
    await expect(page.getByTestId(`toggle-${serviceId}`)).toHaveAttribute(
      'aria-checked',
      before === 'true' ? 'false' : 'true',
    )

    await page.reload()
    await expect(page.getByTestId(`toggle-${serviceId}`)).toHaveAttribute(
      'aria-checked',
      before === 'true' ? 'false' : 'true',
    )

    // Restore.
    await page.getByTestId(`toggle-${serviceId}`).click()
    await expect(page.getByTestId(`toggle-${serviceId}`)).toHaveAttribute(
      'aria-checked',
      before ?? 'true',
    )
  })
})

test.describe('provider dashboard — slot allocation, read-only (P04)', () => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  // ⚠ This suite is READ-ONLY and consumes NO fixture — it never marks an
  // outcome or cancels anything. The FIXTURE TRIPWIRE count therefore stays at
  // 3. If a test here ever mutates, raise that number and seed another row.
  test.beforeEach(async ({ page }) => {
    await login(page, TOWN_RECEPTION)
    await page.waitForURL('**/dashboard/today')
    await page.getByTestId('nav-slots').click()
    await page.waitForURL('**/dashboard/slots**')
    await expect(page.getByTestId('slots-grid').or(page.getByTestId('slots-empty'))).toBeVisible({
      timeout: 30_000,
    })
  })

  test('the day renders real slots, and every one carries a state', async ({ page }) => {
    const cells = page.locator('[data-testid^="slot-"]')
    test.skip((await cells.count()) === 0, 'no slots generated for the selected day')

    // Every cell must resolve to one of the FIVE shared states — a cell with no
    // state means the grid invented a rendering path core does not know about.
    const states = await cells.evaluateAll((els) => els.map((el) => el.getAttribute('data-state')))
    expect(states.length).toBeGreaterThan(0)
    for (const state of states) {
      expect(['booked', 'held', 'available', 'past', 'blocked']).toContain(state)
    }
  })

  test('the summary agrees with the grid it sits beside', async ({ page }) => {
    const cells = page.locator('[data-testid^="slot-"]')
    test.skip((await cells.count()) === 0, 'no slots generated for the selected day')

    // «٤/٥» — booked over capacity. The booked half must equal the number of
    // cells the grid itself painted as booked, or the two halves of the screen
    // are telling the desk different things.
    const fill = await page.getByTestId('allocation-fill').innerText()
    const [bookedAr = ''] = fill.split('/')
    const westernBooked = bookedAr.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    const bookedCells = await page.locator('[data-state="booked"]').count()
    expect(Number(westernBooked)).toBe(bookedCells)
  })

  test('editing is GATED, and says who to ask', async ({ page }) => {
    await expect(page.getByTestId('read-only-pill')).toBeVisible()
    const gate = page.getByTestId('allocation-gate')
    await expect(gate).toBeVisible()
    await expect(gate).toContainText('لتعديل عدد المواعيد تواصل مع إنستاهيلث')
    await expect(page.getByTestId('allocation-support')).toBeVisible()

    // READ-ONLY MEANS READ-ONLY: no control on this screen may be operable.
    // The ghosted +/− are decoration behind the lock, so they must not be
    // real buttons or inputs that a keyboard could reach.
    expect(await gate.locator('button, input, select, textarea').count()).toBe(0)
  })

  test('the explainer says what allocation is and that it does not roll over', async ({ page }) => {
    const explainer = page.getByTestId('allocation-explainer')
    await expect(explainer).toBeVisible()
    await expect(explainer).toContainText('ثلاثين يوماً')
    await expect(explainer).toContainText('لا تُضاف إلى الغد')
  })

  test('switching day keeps the desk where it was on a refresh', async ({ page }) => {
    const days = page.locator('[data-testid^="day-2"]')
    test.skip((await days.count()) < 2, 'only one day in the window')
    await days.nth(1).click()
    await page.waitForURL(/\/dashboard\/slots\?date=\d{4}-\d{2}-\d{2}/)
    const url = page.url()
    await page.reload()
    await expect(page.getByTestId('slots-grid').or(page.getByTestId('slots-empty'))).toBeVisible({
      timeout: 30_000,
    })
    expect(page.url()).toBe(url)
  })
})
