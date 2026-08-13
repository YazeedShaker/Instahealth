import { expect, test } from '@playwright/test'

import { totp, waitForUsableWindow } from './support/totp'

// The commission statement, printed.
//
// ⚠ THIS IS THE ONLY TEST THAT CAN CATCH THE BUG IT GUARDS. The viewport gate
// is pure CSS keyed on width, and a PRINT lays out at the PAPER width, not the
// screen's: A4 portrait is 210mm = 8.27in × 96dpi ≈ 794 CSS px, below the
// gate's 859px floor. So every print of this page rendered the "designed for
// desktop" card instead of the statement — at the statement's own URL, which is
// why the exported PDF looked like a routing bug rather than a CSS one.
//
// Nothing that asserts against the SCREEN can see this. `emulateMedia({ media:
// 'print' })` is what makes the paper layout observable, and the PDF itself is
// the artefact the PR attaches.
//
//   pnpm --filter @instahealth/web exec playwright test print-statement
//
// ⚠ `page.pdf()` is Chromium-only and headless-only — which is what CI and this
// harness both run.

const EMAIL = process.env.FIDELITY_ADMIN_EMAIL ?? ''
const PASSWORD = process.env.FIDELITY_ADMIN_PASSWORD ?? ''
const SECRET = process.env.FIDELITY_ADMIN_TOTP_SECRET ?? ''
const HAS_CREDS = EMAIL.length > 0 && PASSWORD.length > 0 && SECRET.length > 0

test.use({ viewport: { width: 1366, height: 768 } })

test.describe('commission statement — print', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!HAS_CREDS, 'FIDELITY_ADMIN_* not set — see supabase/seeds/007')

  test('prints the STATEMENT, not the desktop-only guard', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByTestId('admin-email').fill(EMAIL)
    await page.getByTestId('admin-password').fill(PASSWORD)
    await page.getByTestId('admin-login-submit').click()
    await page.waitForURL('**/admin/login/verify', { timeout: 20_000 })
    await waitForUsableWindow()
    await page.getByTestId('admin-totp-input').fill(totp(SECRET))
    await page.getByTestId('admin-verify-submit').click()
    await page.waitForURL('**/admin/overview', { timeout: 30_000 })

    await page.goto('/admin/commissions')
    await expect(page.getByTestId('statement-provider')).toBeVisible({ timeout: 60_000 })

    // ── The regression, asserted in PRINT media ────────────────────────────
    await page.emulateMedia({ media: 'print' })

    const guard = page.getByTestId('desktop-only-notice')
    await expect(guard, 'the viewport guard must NEVER render on paper').toBeHidden()

    // And the real thing must be there instead — a hidden guard proves nothing
    // if the content is missing too.
    // ⚠ NOT `statement-provider`: that is the toolbar's provider SELECT, which
    // is `data-print="hide"` and is SUPPOSED to be absent on paper. Asserting it
    // failed the first run — the test catching its own bad assertion, not a
    // product bug. The paper's content is the statement CARD.
    await expect(page.locator('[data-print="card"]').first()).toBeVisible()

    // The paper's own header, which the screen carries in its chrome.
    const title = page.locator('[data-print="title"]')
    await expect(title).toBeVisible()
    await expect(title).toContainText('كشف العمولة')

    await page.emulateMedia({ media: null })
  })

  test('the printed sheet carries the issue stamp, the version and the excluded note', async ({
    page,
  }) => {
    await page.goto('/admin/login')
    await page.getByTestId('admin-email').fill(EMAIL)
    await page.getByTestId('admin-password').fill(PASSWORD)
    await page.getByTestId('admin-login-submit').click()
    await page.waitForURL('**/admin/login/verify', { timeout: 20_000 })
    await waitForUsableWindow()
    await page.getByTestId('admin-totp-input').fill(totp(SECRET))
    await page.getByTestId('admin-verify-submit').click()
    await page.waitForURL('**/admin/overview', { timeout: 30_000 })

    await page.goto('/admin/commissions')
    await expect(page.getByTestId('statement-provider')).toBeVisible({ timeout: 60_000 })
    await page.emulateMedia({ media: 'print' })

    const title = page.locator('[data-print="title"]')
    const text = await title.innerText()

    // ⚠ SPEC-A02: "Export: CSV + print stylesheet, both carrying issue stamp,
    // version, and the excluded-bookings" note. An ISSUED statement must show
    // all three; a draft has no stamp and no version, and saying so is the
    // honest branch rather than skipping.
    const isIssued = !text.includes('مسودة')
    if (isIssued) {
      await expect(title, 'an issued sheet names its version').toContainText('الإصدار')
      await expect(
        page.getByTestId('print-issue-stamp'),
        'an issued sheet carries its issue stamp',
      ).toBeVisible()
    }

    // The excluded strip is "never hidden, per the ruling" — so if there are
    // excluded bookings at all, they must reach the paper.
    const banner = page.getByTestId('statement-excluded-banner')
    if ((await banner.count()) > 0) {
      await expect(banner, 'excluded bookings must be stated on paper').toBeVisible()
    }

    // ── The artefacts ──────────────────────────────────────────────────────
    // A PNG beside the PDF, at A4 landscape's own pixel size (297×210mm at
    // 96dpi = 1123×794). The PDF is what the founder attaches; the PNG is what
    // a reviewer — or a session with no PDF rasteriser — can actually LOOK at,
    // and §9's rule is that the capture only helps if someone looks.
    await page.setViewportSize({ width: 1123, height: 794 })
    await page.screenshot({
      path: '../../docs/design-briefs/a02-fidelity/statement-print.png',
      fullPage: true,
    })

    await page.pdf({
      path: '../../docs/design-briefs/a02-fidelity/statement-print.pdf',
      format: 'A4',
      landscape: true,
      printBackground: true,
    })
    await page.emulateMedia({ media: null })
  })
})
