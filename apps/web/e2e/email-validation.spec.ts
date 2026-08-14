import { expect, test } from '@playwright/test'

// The email field was DECORATIVE on every form that had one.
//
// `LoginForm.tsx` guarded with `!email.includes('@')`, which only DISABLED the
// submit button and rendered nothing — so a malformed address produced silence
// rather than a reason. And because the form then never submitted,
// `type="email"`'s own native bubble never fired either: the two failures hid
// each other. `StaffView.tsx`'s create dialog had the identical predicate.
//
// These tests assert the two halves that were missing — a VISIBLE, announced,
// Arabic reason — and the §1.4 property that made the whole thing a bug rather
// than a papercut: the form and the server now refuse the SAME addresses.
//
// ⚠ EVERY ADDRESS IN `REFUSED` CONTAINS AN '@', so each one PASSED the old
// predicate and would fail this suite on the pre-fix code. A regression test
// for a validation bug that uses `not-an-email` proves nothing.

const REFUSED = [
  'a@b', // no TLD
  'reception@saridarlabs', // no dot
  'reception@', // no domain
  '@saridarlabs.com', // no local part
  'a@b..com', // doubled dot — the case the Edge Function used to allow
  'reception@@saridarlabs.com',
]

test.describe('provider login — the email field states its objection', () => {
  test('a malformed address renders an announced Arabic error', async ({ page }) => {
    await page.goto('/login')
    const email = page.getByTestId('login-email')

    // Nothing is said before the user has had a chance to be right.
    await email.fill('reception@saridar')
    await expect(page.getByTestId('login-email-error')).toHaveCount(0)

    // Blur is the moment the attempt is finished.
    await email.blur()
    const error = page.getByTestId('login-email-error')
    await expect(error).toBeVisible()
    await expect(error).toHaveText(/أدخل بريداً إلكترونياً صحيحاً/)
    // ANNOUNCED, not merely drawn — the defect was a form that failed silently.
    await expect(error).toHaveAttribute('role', 'alert')
    await expect(email).toHaveAttribute('aria-invalid', 'true')

    // The field is described BY the message, so a screen reader reaches it.
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).not.toBeNull()
    await expect(page.locator(`#${describedBy}`)).toHaveText(/أدخل بريداً إلكترونياً صحيحاً/)
  })

  test('the error clears the moment the address becomes valid', async ({ page }) => {
    await page.goto('/login')
    const email = page.getByTestId('login-email')
    await email.fill('a@b')
    await email.blur()
    await expect(page.getByTestId('login-email-error')).toBeVisible()

    // Live again once touched — no second blur required to find out you fixed it.
    await email.fill('reception@saridarlabs.com')
    await expect(page.getByTestId('login-email-error')).toHaveCount(0)
    await expect(email).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('an empty untouched field is silent but still not submittable', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByTestId('login-email-error')).toHaveCount(0)
    await page.getByTestId('login-password').fill('a-real-password')
    await expect(page.getByTestId('login-submit')).toBeDisabled()
  })

  for (const address of REFUSED) {
    test(`refuses ${address} — which includes("@") accepted`, async ({ page }) => {
      expect(address).toContain('@') // the old predicate's whole rule
      await page.goto('/login')
      await page.getByTestId('login-email').fill(address)
      await page.getByTestId('login-email').blur()
      await page.getByTestId('login-password').fill('a-real-password')

      await expect(page.getByTestId('login-email-error')).toBeVisible()
      await expect(page.getByTestId('login-submit')).toBeDisabled()
    })
  }

  test('a well-formed address is accepted by the form and reaches the server', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email').fill('reception@saridarlabs.com')
    await page.getByTestId('login-email').blur()
    await page.getByTestId('login-password').fill('definitely-the-wrong-password')

    await expect(page.getByTestId('login-email-error')).toHaveCount(0)
    await expect(page.getByTestId('login-submit')).toBeEnabled()

    // ⚠ THE §1.4 HALF. The form must not merely stop being an obstacle — the
    // request has to REACH the server and be judged there. A credentials error
    // back from the action proves the address passed BOTH rules; a validation
    // error would mean the two still disagree.
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('login-error')).toBeVisible()
  })
})

test.describe('admin login — the same rule, the same message', () => {
  test('a malformed address renders the Arabic error instead of a browser bubble', async ({
    page,
  }) => {
    await page.goto('/admin/login')
    const email = page.getByTestId('admin-email')
    await email.fill('a@b')
    await email.blur()

    const error = page.getByTestId('admin-email-error')
    await expect(error).toBeVisible()
    await expect(error).toHaveText(/أدخل بريداً إلكترونياً صحيحاً/)
    await expect(error).toHaveAttribute('role', 'alert')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
  })
})
