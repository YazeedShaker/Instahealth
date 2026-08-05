import { expect, test, type Page } from '@playwright/test'

// VIEW-01 — dashboard viewport hardening.
//
// The dashboard's CONTRACT stays desktop-first (DESIGN-02, 1366×768 floor).
// These are not responsiveness tests; they assert GRACEFUL behaviour at the
// edges of real desk life: old 1024 office machines, half-snapped windows,
// projectors, and — the common one nobody designs for — browser zoom.
//
// ⚠ ZOOM IS A WIDTH PROBLEM. Chrome zoom shrinks the CSS viewport, so 125% and
// 150% on the 1366 floor are 1093px and 911px. Playwright cannot set zoom, so
// the zoom cases are asserted at their CSS-equivalent viewports — which is
// exactly what the browser does, not an approximation of it.
//
// Consumes no fixtures: read-only, no mutations, tripwire count unaffected.

const PROVIDER_EMAIL = process.env.PROVIDER_TEST_EMAIL ?? ''
const PROVIDER_PASSWORD = process.env.PROVIDER_TEST_PASSWORD ?? ''
const HAS_CREDS = PROVIDER_EMAIL.length > 0 && PROVIDER_PASSWORD.length > 0

/** 1024 = old office machine · 1366 = the design floor · 1920 = modern desk ·
 * 2560 = projector/large monitor. */
const DESK_WIDTHS = [1024, 1280, 1366, 1920, 2560]

/** CSS-equivalent viewports for browser zoom at the 1366 design floor. */
const ZOOM_VIEWPORTS = [
  { label: '125% on 1366', width: 1093, height: 614 },
  { label: '150% on 1366', width: 911, height: 512 },
]

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(PROVIDER_EMAIL)
  await page.getByTestId('login-password').fill(PROVIDER_PASSWORD)
  await page.getByTestId('login-submit').click()
  await page.waitForURL('**/dashboard/today')
  // Wait for CONTENT, not the URL — waitForURL resolves before the RSC payload
  // paints, and a geometry assertion against an unpainted page measures nothing.
  await expect(page.getByTestId('bookings-list').or(page.getByTestId('today-empty'))).toBeVisible({
    timeout: 30_000,
  })
}

/** Nothing may spill horizontally out of the PAGE, and no ancestor may clip a
 * descendant it cannot scroll. Elements with `text-overflow: ellipsis` are
 * excluded: their scrollWidth exceeds clientWidth BY DESIGN, which is
 * compression working, not breakage. */
async function findClippedContent(page: Page) {
  return page.evaluate(() => {
    const clipped: string[] = []
    for (const element of Array.from(document.querySelectorAll('*'))) {
      const el = element as HTMLElement
      if (el.clientWidth === 0) continue
      if (el.scrollWidth <= el.clientWidth + 1) continue
      const style = getComputedStyle(el)
      if (style.textOverflow === 'ellipsis') continue
      // A scrollable ancestor means the content is REACHABLE — the whole point
      // of the bookings scroller. Only unreachable overflow is a failure.
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue
      clipped.push(
        `<${el.tagName.toLowerCase()} ${el.dataset.testid ?? ''}> ${el.scrollWidth}>${el.clientWidth}`,
      )
    }
    return {
      clipped,
      pageOverflows:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })
}

test.describe('dashboard viewport hardening', () => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  test('1 · nothing clips or becomes unreachable from 1024 to 2560', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await signIn(page)

    for (const width of DESK_WIDTHS) {
      await page.setViewportSize({ width, height: 768 })
      const { clipped, pageOverflows } = await findClippedContent(page)
      expect(pageOverflows, `page scrolls sideways at ${width}px`).toBe(false)
      expect(clipped, `content clipped with no way to reach it at ${width}px`).toEqual([])

      // The two things the spec says may never be hidden: the row's primary
      // ACTION and the PAYMENT state. Assert they are inside the viewport,
      // not merely present in the DOM.
      const rows = page.getByTestId(/^booking-row-/)
      if ((await rows.count()) === 0) continue

      const payment = page.getByTestId(/^payment-/).first()
      const paymentBox = await payment.boundingBox()
      expect(paymentBox, `payment cell missing at ${width}px`).not.toBeNull()
      expect(paymentBox!.x, `payment state pushed off-screen at ${width}px`).toBeGreaterThanOrEqual(
        0,
      )
      expect(
        paymentBox!.x + paymentBox!.width,
        `payment state cut off at ${width}px`,
      ).toBeLessThanOrEqual(width + 1)
      // The cash chip is nowrap: if its column were compressed the amount
      // would be clipped inside its own cell.
      const paymentClipped = await payment.evaluate(
        (el) => el.scrollWidth > (el as HTMLElement).clientWidth + 1,
      )
      expect(paymentClipped, `payment amount clipped inside its cell at ${width}px`).toBe(false)
    }
  })

  test('2 · browser zoom 125% and 150% keep the row and the drawer usable', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await signIn(page)

    for (const zoom of ZOOM_VIEWPORTS) {
      await page.setViewportSize({ width: zoom.width, height: zoom.height })

      const { pageOverflows } = await findClippedContent(page)
      expect(pageOverflows, `page scrolls sideways at ${zoom.label}`).toBe(false)

      // The header carries the logout — it wraps rather than clipping it.
      const header = page.locator('header').first()
      const headerClipped = await header.evaluate(
        (el) => el.scrollWidth > (el as HTMLElement).clientWidth + 1,
      )
      expect(headerClipped, `header clipped at ${zoom.label}`).toBe(false)
      await expect(page.getByTestId('logout'), `logout unreachable at ${zoom.label}`).toBeVisible()

      const rows = page.getByTestId(/^booking-row-/)
      if ((await rows.count()) === 0) continue

      // The drawer must open, fit, and be closable at zoom.
      await rows.first().click()
      const drawer = page.getByTestId('booking-drawer')
      await expect(drawer, `drawer did not open at ${zoom.label}`).toBeVisible()
      const box = await drawer.boundingBox()
      expect(box!.x, `drawer starts off-screen at ${zoom.label}`).toBeGreaterThanOrEqual(0)
      expect(box!.width, `drawer wider than the viewport at ${zoom.label}`).toBeLessThanOrEqual(
        zoom.width,
      )
      const close = page.getByTestId('drawer-close')
      await expect(close, `drawer close unreachable at ${zoom.label}`).toBeVisible()
      await close.click()
      await expect(drawer).toBeHidden()
    }
  })

  test('3 · too narrow shows the desktop notice — and zoom never triggers it', async ({
    browser,
  }) => {
    // ⚠ THE TRAP THIS TEST EXISTS FOR: a width-only gate at 1024 would show
    // "use a computer" to a receptionist on her actual desktop at 150% zoom
    // (911px). The gate pairs a hard floor with `pointer: coarse`, and these
    // assertions are what stop a future simplification from reintroducing it.
    const desktop = await browser.newContext({ viewport: { width: 1366, height: 768 } })
    const page = await desktop.newPage()
    await signIn(page)

    for (const width of [1093, 911, 880]) {
      await page.setViewportSize({ width, height: 700 })
      await expect(
        page.getByTestId('desktop-only-notice'),
        `a zoomed DESKTOP was told to use a desktop at ${width}px`,
      ).toBeHidden()
      await expect(
        page.getByTestId('bookings-list').or(page.getByTestId('today-empty')),
      ).toBeVisible()
    }

    // Below the hard floor no device can render the table — say so calmly.
    await page.setViewportSize({ width: 800, height: 700 })
    await expect(page.getByTestId('desktop-only-notice')).toBeVisible()
    await expect(page.getByTestId('desktop-only-notice')).toContainText(
      'لوحة التحكم مصممة لشاشة الكمبيوتر',
    )
    await expect(page.getByTestId('bookings-list')).toBeHidden()
    await desktop.close()

    // A touch device — the receptionist opening it on her phone by accident.
    // Landscape (932px) is the case a width-only rule cannot catch.
    //
    // ⚠ Signed in at a DESKTOP size first, then shrunk: `hasTouch` is a
    // context-level property (it is what makes `pointer: coarse` true), while
    // the viewport is per-page. Signing in at 390px would hang the helper
    // forever waiting for a bookings list the gate is correctly hiding.
    const phone = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      hasTouch: true,
    })
    const phonePage = await phone.newPage()
    await signIn(phonePage)
    for (const size of [
      { width: 390, height: 844, label: 'portrait' },
      { width: 932, height: 430, label: 'landscape' },
    ]) {
      await phonePage.setViewportSize({ width: size.width, height: size.height })
      await expect(
        phonePage.getByTestId('desktop-only-notice'),
        `phone ${size.label} got the dashboard instead of the notice`,
      ).toBeVisible()
      await expect(phonePage.getByTestId('bookings-list')).toBeHidden()
    }
    await phone.close()
  })
})
