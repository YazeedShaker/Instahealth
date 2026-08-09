import { createHmac, randomBytes } from 'node:crypto'

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

    // A placeholder surface still carries its REAL title and its spec id.
    await page.getByTestId('admin-nav-commissions').click()
    await page.waitForURL('**/admin/commissions')
    await expect(page.getByTestId('admin-commissions')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('admin-soon-chip')).toBeVisible()
    await expect(page.getByTestId('admin-commissions-spec')).toContainText('A02')
  })

  test('an unauthenticated visitor cannot reach /admin', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/admin/overview')
    await page.waitForURL('**/admin/login')
    await expect(page.getByTestId('admin-email')).toBeVisible({ timeout: 30_000 })
  })

  test('THE TWO PORTALS NEVER CONFUSE THEIR SESSIONS', async ({ page }) => {
    test.skip(!HAS_PROVIDER, 'PROVIDER_TEST_* not set')

    // ① A provider signing in at the ADMIN door is refused and signed back out
    //    — valid credentials are not an authorisation (the P01 law).
    await signInWithPassword(page, PROVIDER_EMAIL, PROVIDER_PASSWORD)
    await expect(page.getByTestId('admin-login-error')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('admin-login-error')).toContainText('لا يملك صلاحية')

    // …and the refusal really did sign them out, rather than leaving a
    // half-authenticated session on the machine.
    await page.goto('/admin/overview')
    await page.waitForURL('**/admin/login**')

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
