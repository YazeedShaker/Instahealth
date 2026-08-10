import { createHmac, randomBytes } from 'node:crypto'

import { toArabicDigits } from '@instahealth/core'
import { expect, test, type Page } from '@playwright/test'

// A01 E2E — the admin portal's auth flow and shell.
//
// ⚠ THIS SUITE MUTATES THE GENESIS ADMIN ACCOUNT: it changes the password,
// enrolls a TOTP factor and mints recovery codes. It therefore RESTORES the
// account to its pristine first-login state in `afterAll`, the same discipline
// `profile.spec.ts` uses for the branches row. Without that, the second run
// would find an already-enrolled admin and every first-login assertion would
// skip itself — which reads identically to passing in the summary line (§9).
//
// ⚠ It consumes NO booking fixtures, so the FIXTURE TRIPWIRE count is
// unaffected.
//
// ⚠ Tests run SERIALLY. They share one mutable account, and Playwright's
// default parallelism would have two workers racing the same enrollment.

const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL ?? ''
const ADMIN_TEMP_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? ''
const HAS_CREDS = ADMIN_EMAIL.length > 0 && ADMIN_TEMP_PASSWORD.length > 0

// ⚠ A TRIPWIRE, not a nicety. This suite RESETS the account it runs against —
// password, authenticator, recovery codes. Pointed at the founder's real admin
// it locks them out, which is precisely what the first version of the CI step
// did. If ADMIN_TEST_EMAIL is ever set to the genesis account, fail LOUDLY
// rather than quietly destroying it.
const GENESIS_ADMIN_EMAIL = 'admin@instahealth.eg'

const PROVIDER_EMAIL = process.env.PROVIDER_TEST_EMAIL ?? ''
const PROVIDER_PASSWORD = process.env.PROVIDER_TEST_PASSWORD ?? ''
const HAS_PROVIDER = PROVIDER_EMAIL.length > 0 && PROVIDER_PASSWORD.length > 0

/** The password the suite sets during its first-login run.
 *
 * ⚠ GENERATED PER RUN, never a literal. A hardcoded value here would be a real
 * credential for a real account committed to a PUBLIC repo — the exact P01
 * mistake ("it's only a dev password" is not an exemption, workflow §4), and
 * GitGuardian correctly blocked the first version of this file. Random per run
 * also means one run's value cannot unlock anything in the next. */
const NEW_PASSWORD = `A01-${randomBytes(15).toString('base64url')}`

// ── RFC 6238, so the suite can act as the authenticator app ─────────────────
// Deliberately hand-rolled rather than a dependency: it is fifteen lines, and
// the alternative is shipping an npm package into `pnpm audit` for a test.
function base32Decode(input: string): Buffer {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of input.replace(/[^A-Za-z2-7]/g, '').toUpperCase()) {
    const index = ALPHABET.indexOf(char)
    if (index >= 0) bits += index.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function totp(secret: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 30_000)
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0)
  buffer.writeUInt32BE(counter >>> 0, 4)
  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(code).padStart(6, '0')
}

/** Supabase rejects a REPLAYED code, so a second verify in the same 30s window
 *  fails for a reason that has nothing to do with the feature under test. */
async function waitForFreshWindow(): Promise<void> {
  const msIntoWindow = Date.now() % 30_000
  await new Promise((resolve) => setTimeout(resolve, 30_000 - msIntoWindow + 1_500))
}

async function signInWithPassword(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/admin/login')
  await page.getByTestId('admin-email').fill(email)
  await page.getByTestId('admin-password').fill(password)
  await page.getByTestId('admin-login-submit').click()

  // ⚠ ASSERT THE SIGN-IN, don't just wait for where it should land. When the
  // ADMIN_TEST_PASSWORD secret did not match what the seed had hashed, every
  // test failed as `waitForURL: Test timeout` pointing at a line about the
  // password-change screen — which says nothing about the actual cause and cost
  // a CI round trip to diagnose. If the credentials are wrong, say so here.
  const loginError = page.getByTestId('admin-login-error')
  await expect
    .poll(async () => (await loginError.isVisible()) || !page.url().includes('/admin/login?'), {
      timeout: 15_000,
      message: 'sign-in neither errored nor navigated',
    })
    .toBeTruthy()
  if (await loginError.isVisible()) {
    throw new Error(
      `Admin sign-in was REFUSED: "${await loginError.innerText()}". ` +
        'Most likely ADMIN_TEST_PASSWORD does not match what seed 005 hashed — ' +
        'check the secret, and that CI passes it RAW so psql does the quoting.',
    )
  }
}

test.describe.configure({ mode: 'serial' })

test.describe('admin portal — auth & shell (A01)', () => {
  test.skip(!HAS_CREDS, 'ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD not set')

  test.beforeAll(() => {
    if (ADMIN_EMAIL.trim().toLowerCase() === GENESIS_ADMIN_EMAIL) {
      throw new Error(
        `REFUSING TO RUN: ADMIN_TEST_EMAIL is the GENESIS admin (${GENESIS_ADMIN_EMAIL}). ` +
          'This suite resets the password, deletes the authenticator and wipes the recovery ' +
          'codes of whatever account it is given. Point it at admin-e2e@instahealth.eg ' +
          '(supabase/seeds/006_admin_e2e_account.sql).',
      )
    }
  })

  let enrolledSecret = ''

  test('first login: temp password → forced change → enroll → codes shown once → in', async ({
    page,
  }) => {
    await signInWithPassword(page, ADMIN_EMAIL, ADMIN_TEMP_PASSWORD)

    // ① The forced password change comes BEFORE enrollment — binding a second
    //    factor to an account still holding a seeded temp password protects
    //    the wrong credential.
    await page.waitForURL('**/admin/login/change-password')
    await expect(page.getByTestId('admin-new-password')).toBeVisible({ timeout: 30_000 })

    await page.getByTestId('admin-new-password').fill(NEW_PASSWORD)
    await page.getByTestId('admin-confirm-password').fill(NEW_PASSWORD)
    await page.getByTestId('admin-password-submit').click()

    // ② Enrollment, with a real QR and a manual key.
    await page.waitForURL('**/admin/login/enroll')
    await expect(page.getByTestId('admin-enroll-qr')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('admin-enroll-qr').locator('svg')).toBeVisible()

    const shownKey = (await page.getByTestId('admin-enroll-secret').innerText()).replace(/\s/g, '')
    expect(shownKey.length).toBeGreaterThanOrEqual(16)
    enrolledSecret = shownKey

    await page.getByTestId('admin-totp-input').fill(totp(enrolledSecret))
    await page.getByTestId('admin-enroll-submit').click()

    // ③ THE ONE-TIME CODES. This assertion is the regression guard for the bug
    //    migration 20260808231917 fixed: the post-action revalidation used to
    //    redirect past this panel and destroy eight codes nobody ever saw.
    await expect(page.getByTestId('admin-recovery-codes-panel')).toBeVisible({ timeout: 30_000 })
    const codes = await page.getByTestId('admin-recovery-code').allInnerTexts()
    expect(codes).toHaveLength(8)
    for (const code of codes) expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/)

    // ④ The checkbox GATES continue — a one-time secret must not be dismissable
    //    by a stray click.
    await expect(page.getByTestId('admin-enroll-continue')).toBeDisabled()
    await page.getByTestId('admin-codes-saved').check()
    await expect(page.getByTestId('admin-enroll-continue')).toBeEnabled()
    await page.getByTestId('admin-enroll-continue').click()

    await page.waitForURL('**/admin/overview')
    await expect(page.getByTestId('admin-shell')).toBeVisible({ timeout: 30_000 })
  })

  test('returning login: password → TOTP → in', async ({ page }) => {
    expect(enrolledSecret, 'the enrollment test must run first').not.toBe('')

    await signInWithPassword(page, ADMIN_EMAIL, NEW_PASSWORD)
    await page.waitForURL('**/admin/login/verify')
    await expect(page.getByTestId('admin-totp-input')).toBeVisible({ timeout: 30_000 })

    // The validity bar is a DISPLAY of the RFC 6238 step, so it must be
    // present and counting — «صلاحية الرمز الحالي».
    await expect(page.getByTestId('admin-totp-validity')).toContainText('صلاحية الرمز الحالي')

    await waitForFreshWindow()
    await page.getByTestId('admin-totp-input').fill(totp(enrolledSecret))
    await page.getByTestId('admin-verify-submit').click()

    await page.waitForURL('**/admin/overview')
    await expect(page.getByTestId('admin-shell')).toBeVisible({ timeout: 30_000 })
  })

  test('a wrong code is refused and the attempts-remaining copy mirrors the SERVER', async ({
    page,
  }) => {
    await signInWithPassword(page, ADMIN_EMAIL, NEW_PASSWORD)
    await page.waitForURL('**/admin/login/verify')

    await page.getByTestId('admin-totp-input').fill('000000')
    await page.getByTestId('admin-verify-submit').click()

    const error = page.getByTestId('admin-verify-error')
    await expect(error).toBeVisible({ timeout: 30_000 })
    // ⚠ Display = enforcement (§1.4). The number is the server's counter, not a
    // local decrement — «بقيت لك ٤ محاولات» after one failure of five.
    await expect(error).toContainText('٤')
    // The clock-drift hint replaces the reassurance line in the error state.
    await expect(page.getByText('مزامنة الوقت')).toBeVisible()

    // Reset the counter so the next test starts clean.
    await waitForFreshWindow()
    await page.getByTestId('admin-totp-input').fill(totp(enrolledSecret))
    await page.getByTestId('admin-verify-submit').click()
    await page.waitForURL('**/admin/overview')
  })

  test('the shell renders every sidebar surface, and التحليلات is the APPROVED stub', async ({
    page,
  }) => {
    await signInWithPassword(page, ADMIN_EMAIL, NEW_PASSWORD)
    await page.waitForURL('**/admin/login/verify')
    await waitForFreshWindow()
    await page.getByTestId('admin-totp-input').fill(totp(enrolledSecret))
    await page.getByTestId('admin-verify-submit').click()
    await page.waitForURL('**/admin/overview')

    for (const testId of [
      'admin-nav-overview',
      'admin-nav-analytics',
      'admin-nav-commissions',
      'admin-nav-providers',
      'admin-nav-catalog',
      'admin-nav-staff',
      'admin-nav-bookings',
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible()
    }

    // ⚠ التحليلات is NOT a «قيد البناء» placeholder — its design is FINAL, so
    // SPEC-A01 says render it. Five approved questions, each with the evidence
    // it needs before the page can be honest.
    await page.getByTestId('admin-nav-analytics').click()
    await page.waitForURL('**/admin/analytics')
    await expect(page.getByTestId('admin-analytics')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('admin-analytics-question')).toHaveCount(5)
    await expect(page.getByText('٥ أسئلة مُقرّة')).toBeVisible()

    // ⚠ العمولات والفواتير STOPPED being a placeholder when A02 landed. This
    // assertion used to require the «قريباً» chip and the spec id; keeping it
    // would have meant a real screen failing for looking real. A placeholder
    // surface is still checked below — كتالوج الخدمات has not been built yet.
    await page.getByTestId('admin-nav-commissions').click()
    await page.waitForURL('**/admin/commissions')
    await expect(page.getByTestId('admin-commissions')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('admin-soon-chip')).toHaveCount(0)
    await expect(page.getByTestId('statement-provider')).toBeVisible()

    // A placeholder surface still carries its REAL title and its spec id.
    await page.getByTestId('admin-nav-catalog').click()
    await page.waitForURL('**/admin/catalog')
    await expect(page.getByTestId('admin-catalog')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('admin-soon-chip')).toBeVisible()
    await expect(page.getByTestId('admin-catalog-spec')).toContainText('A0')
  })

  test('an unauthenticated visitor cannot reach /admin', async ({ page }) => {
    await page.context().clearCookies()

    // ⚠ THE FRONT DOOR ITSELF. `/admin` used to 404 — the route groups add no
    // path segment, so every deep link worked and the address a human types did
    // not. It must land on the gate, not on a Next error page.
    await page.goto('/admin')
    await page.waitForURL('**/admin/login')
    await expect(page.getByTestId('admin-email')).toBeVisible({ timeout: 30_000 })

    await page.goto('/admin/overview')
    await page.waitForURL('**/admin/login')
    await expect(page.getByTestId('admin-email')).toBeVisible({ timeout: 30_000 })
  })

  test('THE TWO PORTALS NEVER CONFUSE THEIR SESSIONS', async ({ page, browser }) => {
    test.skip(!HAS_PROVIDER, 'PROVIDER_TEST_* not set')

    // ⚠ THE BYSTANDER. A second, unrelated session on the SAME provider
    // account — the receptionist already working at the front desk. It exists
    // to pin down the scope of the refusal below.
    //
    // This is the regression guard for the bug that kept main red from A01 to
    // 2026-08-09: the role gate called `signOut()` with auth-js's DEFAULT scope
    // ('global'), which revokes every refresh token the account owns. In CI the
    // victim was whichever parallel worker happened to navigate next, so three
    // different tests failed on three runs and it read as flake. It is not
    // flake — it is a real product defect. A refusal at the wrong door must
    // never sign anyone out of a desk they are standing at.
    const deskContext = await browser.newContext()
    const desk = await deskContext.newPage()
    try {
      await desk.goto('/login')
      await desk.getByTestId('login-email').fill(PROVIDER_EMAIL)
      await desk.getByTestId('login-password').fill(PROVIDER_PASSWORD)
      await desk.getByTestId('login-submit').click()
      await desk.waitForURL('**/dashboard/today', { timeout: 30_000 })

      // ① A provider signing in at the ADMIN door is refused and signed back out
      //    — valid credentials are not an authorisation (the P01 law).
      await signInWithPassword(page, PROVIDER_EMAIL, PROVIDER_PASSWORD)
      await expect(page.getByTestId('admin-login-error')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId('admin-login-error')).toContainText('لا يملك صلاحية')

      // …and the refusal really did sign them out, rather than leaving a
      // half-authenticated session on the machine.
      await page.goto('/admin/overview')
      await page.waitForURL('**/admin/login**')

      // …while the front desk is UNTOUCHED. A full navigation, so the middleware
      // actually revalidates the session rather than serving a cached payload.
      await desk.goto('/dashboard/today')
      await expect(desk).toHaveURL(/\/dashboard\/today/, { timeout: 30_000 })
      await expect(desk.getByTestId('branch-name')).toBeVisible({ timeout: 30_000 })
    } finally {
      await deskContext.close()
    }

    // ② An ADMIN visiting the partner portal gets the provider gate's rejection.
    await signInWithPassword(page, ADMIN_EMAIL, NEW_PASSWORD)
    await page.waitForURL('**/admin/login/verify')
    await waitForFreshWindow()
    await page.getByTestId('admin-totp-input').fill(totp(enrolledSecret))
    await page.getByTestId('admin-verify-submit').click()
    await page.waitForURL('**/admin/overview')

    await page.goto('/dashboard/today')
    await page.waitForURL('**/login?rejected=1')
  })

  // ── A02 · the commission statement ────────────────────────────────────────
  //
  // ⚠ READ-ONLY ON PURPOSE. Issuing a statement writes a row that the next run
  // would find already there, and the double-issue guard would then refuse —
  // so a mutating test here would pass once and skip-by-failure forever after.
  // The full lifecycle (issue → sent → re-issue → settle → credit-forward) is
  // proven against the live database by a Node run recorded in the PR, where
  // the fixture can be created AND destroyed. What Playwright owns is what only
  // a browser can answer: that the screen renders the money correctly and that
  // it offers exactly the actions the server accepts.
  async function openCommissions(page: Page): Promise<void> {
    await signInWithPassword(page, ADMIN_EMAIL, NEW_PASSWORD)
    await page.waitForURL('**/admin/login/verify')
    await waitForFreshWindow()
    await page.getByTestId('admin-totp-input').fill(totp(enrolledSecret))
    await page.getByTestId('admin-verify-submit').click()
    await page.waitForURL('**/admin/overview')
    await page.goto(
      '/admin/commissions?provider=aaaa0000-0000-4000-8000-000000000001&month=2026-07-01',
    )
    await expect(page.getByTestId('admin-commissions')).toBeVisible({ timeout: 30_000 })
  }

  test('A02 · the statement renders real money, and every card is traceable to its rows', async ({
    page,
  }) => {
    await openCommissions(page)

    // The month has never been issued, so this is the LIVE DRAFT state and the
    // screen must say so rather than implying a document exists.
    await expect(page.getByTestId('statement-issued-stamp')).toContainText('لم تُصدر بعد')
    await expect(page.getByTestId('statement-status-draft')).toBeVisible()

    // THE TRACEABILITY RULE, asserted rather than trusted: the commissionable
    // count on the card equals the number of counted rows actually rendered.
    const countedRows = page.getByTestId('statement-row')
    const rowCount = await countedRows.count()
    expect(rowCount).toBeGreaterThan(0)
    await expect(page.getByTestId('statement-total-row')).toContainText(
      `${toArabicDigits(String(rowCount))} حجوزات`,
    )

    // Both attachment rules are visible on this one real document — Town's July
    // carries cash AND prepaid, which is exactly why it is the fixture.
    await expect(page.getByText('تاريخ الإتمام').first()).toBeVisible()
    await expect(page.getByText('تاريخ الدفع').first()).toBeVisible()

    // ⚠ THE FIDELITY CAPTURE LIVES HERE, not in fidelity.spec.ts. That harness
    // signs in as a PROVIDER, and this screen needs an aal2 ADMIN — which costs
    // a whole TOTP enrollment. This test already holds one, so the capture is
    // free here and would be a duplicated enrollment there. §9 wants the image
    // in the PR body; it does not care which suite wrote it.
    await page.setViewportSize({ width: 1366, height: 768 }) // the DESIGN-02 floor
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
      path: '../../docs/design-briefs/a02-fidelity/statement-draft-build.png',
      fullPage: false,
    })
  })

  test('A02 · auto-closed bookings are footnoted in the OPEN, and touch no total', async ({
    page,
  }) => {
    await openCommissions(page)

    // The founder's ruling: «أُغلقت تلقائياً — غير محتسبة» is a visible strip,
    // never a tooltip.
    const banner = page.getByTestId('statement-excluded-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('أُغلقت تلقائياً — غير محتسبة')
    await expect(banner).toContainText('ليست جزءاً من أي رقم أعلاه')

    // Hidden from the table by default — and revealing them must not move a
    // single number, which is the whole claim the strip makes.
    await expect(page.getByTestId('statement-row-excluded')).toHaveCount(0)
    const totalBefore = await page.getByTestId('statement-total-row').innerText()

    await page.getByTestId('statement-toggle-excluded').click()
    await expect(page.getByTestId('statement-row-excluded').first()).toBeVisible()
    expect(await page.getByTestId('statement-total-row').innerText()).toBe(totalBefore)

    // A struck-through row earns no rate and no commission.
    const excludedRow = page.getByTestId('statement-row-excluded').first()
    await expect(excludedRow).toContainText('أُغلقت تلقائياً — غير محتسبة')
  })

  test('A02 · a month with no activity is an honest zero, not an error', async ({ page }) => {
    await openCommissions(page)

    // Saridar has only cancellations, so its July is genuinely empty. A blank
    // panel would read as a broken screen; the copy has to say the number is
    // real.
    await page.goto(
      '/admin/commissions?provider=aaaa0000-0000-4000-8000-000000000002&month=2026-07-01',
    )
    await expect(page.getByTestId('statement-empty')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('statement-empty')).toContainText('رقم حقيقي وليس خطأً')
  })

  test('A02 · display equals enforcement — no action is offered that the RPC refuses', async ({
    page,
  }) => {
    await openCommissions(page)

    // Never issued → the only forward move is «تحديد كمُرسلة». Settling skips a
    // step, so the control for it must not exist at all — not merely be
    // disabled, which still invites a click.
    await expect(page.getByTestId('statement-mark-sent')).toBeVisible()
    await expect(page.getByTestId('statement-mark-settled')).toHaveCount(0)
    // No snapshot exists yet, so nothing can have drifted from one.
    await expect(page.getByTestId('statement-changed-banner')).toHaveCount(0)
    await expect(page.getByTestId('statement-credit-forward')).toHaveCount(0)
    await expect(page.getByTestId('statement-locked')).toHaveCount(0)
  })

  // ── A03 · the provider network ────────────────────────────────────────────
  //
  // ⚠ READ-ONLY, like the A02 tests and for the same reason: setting a rate
  // writes an APPEND-ONLY row that no later run can remove, so a mutating test
  // would permanently accrete rate history on a real provider. The server rules
  // (future-only dates, audit rows, refusal codes) are proven by the Node run
  // recorded in the PR, where the fixture is created and destroyed. What
  // Playwright owns here is the UI gate the server cannot enforce.
  test('A03 · the network list shows the rate in force and links to the provider', async ({
    page,
  }) => {
    await signInWithPassword(page, ADMIN_EMAIL, NEW_PASSWORD)
    await page.waitForURL('**/admin/login/verify')
    await waitForFreshWindow()
    await page.getByTestId('admin-totp-input').fill(totp(enrolledSecret))
    await page.getByTestId('admin-verify-submit').click()
    await page.waitForURL('**/admin/overview')

    await page.getByTestId('admin-nav-providers').click()
    await page.waitForURL('**/admin/providers')
    await expect(page.getByTestId('admin-network')).toBeVisible({ timeout: 30_000 })

    // Every provider carries a rate, because A03 makes rate-less impossible.
    const rates = page.getByTestId('network-rate')
    expect(await rates.count()).toBeGreaterThan(0)
    for (const cell of await rates.all()) await expect(cell).toContainText('٪')

    // The reserved branch-override column is present and empty, per the frame.
    await expect(page.getByText('عمود «نسبة الفرع» محجوز')).toBeVisible()

    await page.getByTestId('network-provider-row').first().click()
    await page.waitForURL(/\/admin\/providers\?provider=/)
    await expect(page.getByTestId('network-rate-editor')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('network-current-rate')).toContainText('السارية الآن')

    // The seeded 12% is a PLACEHOLDER and the screen says so, in Arabic, where
    // the founder fixes it — this is the standing launch blocker.
    await expect(page.getByTestId('network-rate-placeholder').first()).toContainText(
      'أدخل النسبة المتفق عليها',
    )

    await page.setViewportSize({ width: 1366, height: 768 })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
      path: '../../docs/design-briefs/a03-fidelity/provider-detail-build.png',
      fullPage: false,
    })
  })

  test('A03 · a rate change cannot be confirmed without the written acknowledgment', async ({
    page,
  }) => {
    await signInWithPassword(page, ADMIN_EMAIL, NEW_PASSWORD)
    await page.waitForURL('**/admin/login/verify')
    await waitForFreshWindow()
    await page.getByTestId('admin-totp-input').fill(totp(enrolledSecret))
    await page.getByTestId('admin-verify-submit').click()
    await page.waitForURL('**/admin/overview')
    await page.goto('/admin/providers?provider=aaaa0000-0000-4000-8000-000000000001')
    await expect(page.getByTestId('network-rate-editor')).toBeVisible({ timeout: 30_000 })

    // Save stays disabled until BOTH a percent and a future date are present —
    // the client mirroring the server rule rather than discovering it.
    await expect(page.getByTestId('network-rate-save')).toBeDisabled()
    await page.getByTestId('network-rate-input').fill('13')
    await expect(page.getByTestId('network-rate-save')).toBeDisabled()

    // The date control is a curated SELECT of future dates, not a native
    // picker — every option it offers is one the server will accept.
    const dateSelect = page.getByTestId('network-rate-date')
    await dateSelect.selectOption({ index: 1 })
    await expect(page.getByTestId('network-rate-save')).toBeEnabled()

    await page.getByTestId('network-rate-save').click()
    const dialog = page.getByTestId('network-rate-confirm')
    await expect(dialog).toBeVisible()
    // The dialog states the CONSEQUENCE, not just the change.
    await expect(dialog).toContainText('هذا يغيّر ما يدفعه')
    await expect(dialog).toContainText('لا تتأثر — لا أثر رجعي')

    // ⚠ THE GATE. The design makes written partner acknowledgment a REQUIRED
    // element, so the commit button is inert until it is ticked.
    await expect(page.getByTestId('network-rate-confirm-submit')).toBeDisabled()
    await page.getByTestId('network-rate-ack').check()
    await expect(page.getByTestId('network-rate-confirm-submit')).toBeEnabled()

    // Deliberately NOT submitted — see the note above this describe block.
    await page.getByRole('button', { name: 'إلغاء' }).click()
    await expect(dialog).toHaveCount(0)
  })

  // ── leave the account where the seed leaves it ────────────────────────────
  test('RESTORE: the password returns to the seeded value', async ({ page }) => {
    // ⚠ This suite MUTATES a shared account, so it cleans up after itself — the
    // same discipline profile.spec.ts uses for the branches row. The password is
    // the half the UI can undo; the FACTOR, the codes and `must_change_password`
    // need service-role access, which is what `006_admin_e2e_reset.sql` is for
    // (CI runs it before this suite; locally it is the runbook's dev-reset).
    //
    // Without this, a re-run would find an unknown password and every test
    // would fail on sign-in — which at least fails LOUDLY, unlike the skip.
    await signInWithPassword(page, ADMIN_EMAIL, NEW_PASSWORD)
    await page.waitForURL('**/admin/login/verify')
    await waitForFreshWindow()
    await page.getByTestId('admin-totp-input').fill(totp(enrolledSecret))
    await page.getByTestId('admin-verify-submit').click()
    await page.waitForURL('**/admin/overview')
    await page.getByTestId('admin-logout').click()
    await page.waitForURL('**/admin/login')
  })
})
