import { expect, test, type Page } from '@playwright/test'

// THE CONNECTION-DOT AUDIT — «متصل / غير متصل» on the Today header.
//
// The dot makes TWO promises to a receptionist, and they were audited apart:
//
//  ① «سيتم التحديث تلقائياً كل دقيقة» — the polling fallback. ALREADY BANKED as
//    real and unconditional: `useBranchBookings.ts` sets `refetchInterval:
//    POLL_MS` (60_000) on the query itself, with no reference to the socket, so
//    nothing about the realtime channel can switch it off. Re-asserted here
//    against the NETWORK rather than the source, because a constant in a file
//    is not a request on a wire.
//
//  ② That the dot TRACKS THE SOCKET at all. This was the open question.
//    `setIsConnected(state === 'SUBSCRIBED')` (~:261) is the only writer in the
//    hook, and whether supabase-js invokes that callback again when the
//    connection DROPS — and once more when it REJOINS — is not answerable by
//    reading our code, because the answer lives in the library. A dot that
//    latches to «متصل» on first subscribe and never moves is WORSE than no dot:
//    it tells the desk its screen is live at the exact moment it has stopped
//    being live.
//
// Both directions are tested. One direction proves only that something else was
// already refusing to change it.

const PROVIDER_EMAIL = process.env.PROVIDER_TEST_EMAIL ?? ''
const PROVIDER_PASSWORD = process.env.PROVIDER_TEST_PASSWORD ?? ''
const HAS_CREDS = PROVIDER_EMAIL.length > 0 && PROVIDER_PASSWORD.length > 0

async function loginToToday(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(PROVIDER_EMAIL)
  await page.getByTestId('login-password').fill(PROVIDER_PASSWORD)
  await page.getByTestId('login-submit').click()
  await page.waitForURL('**/dashboard/today')
  await expect(page.getByTestId('branch-name')).toBeVisible({ timeout: 30_000 })
}

const dot = (page: Page) => page.getByTestId('connection-dot')

test.describe('the connection dot tracks the socket, both directions', () => {
  test.skip(!HAS_CREDS, 'PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD not set')

  test('drops to «غير متصل» when the connection goes, and recovers when it returns', async ({
    page,
    context,
  }) => {
    await loginToToday(page)

    // ── baseline: the socket joins and the dot says so ──────────────────────
    await expect(dot(page)).toHaveAttribute('data-connected', 'yes', { timeout: 30_000 })
    await expect(dot(page)).toContainText('متصل')
    await expect(dot(page)).toHaveAttribute('title', 'التحديث فوري')

    // ── the drop ────────────────────────────────────────────────────────────
    // The whole question: does the subscribe callback fire again?
    await context.setOffline(true)
    await expect(dot(page)).toHaveAttribute('data-connected', 'no', { timeout: 60_000 })
    await expect(dot(page)).toContainText('غير متصل')
    // ⚠ The tooltip is the PROMISE the desk is given while disconnected, so it
    // is asserted here rather than taken on trust — it is only honest because
    // of the poll, which the next test measures.
    await expect(dot(page)).toHaveAttribute('title', 'سيتم التحديث تلقائياً كل دقيقة')

    // ── the rejoin ──────────────────────────────────────────────────────────
    await context.setOffline(false)
    await expect(dot(page)).toHaveAttribute('data-connected', 'yes', { timeout: 90_000 })
    await expect(dot(page)).toContainText('متصل')
  })

  test('the poll keeps firing while the socket is down — the tooltip is honest', async ({
    page,
    context,
  }) => {
    // ⚠ Only the WEBSOCKET is killed, not the network. `setOffline(true)` would
    // stop the poll from LANDING too, which proves nothing about whether it was
    // attempted — and the claim under test is that the poll is independent of
    // the socket, not that it survives having no network at all.
    await loginToToday(page)
    await expect(dot(page)).toHaveAttribute('data-connected', 'yes', { timeout: 30_000 })

    // Count the data reads. The dashboard reads through PostgREST RPC.
    const polls: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/rest/v1/rpc/')) polls.push(new Date().toISOString())
    })

    // Kill the socket and keep it dead.
    await page.routeWebSocket(/realtime/, (ws) => ws.close())
    await context.setOffline(true)
    await context.setOffline(false)

    // The desk has SEEN the disconnected state — this is the window the
    // «كل دقيقة» promise is made in.
    await expect(dot(page)).toHaveAttribute('data-connected', 'no', { timeout: 60_000 })

    const before = polls.length
    // POLL_MS is 60s; wait for two windows so a single boundary cannot decide it.
    await page.waitForTimeout(130_000)
    const landed = polls.length - before

    console.log(`polls after the socket dropped: ${landed} in 130s (POLL_MS = 60s)`)
    expect(landed).toBeGreaterThanOrEqual(2)

    // ⚠ DELIBERATELY NOT ASSERTING THE DOT IS STILL «غير متصل» HERE. It was,
    // before this PR, permanently — and an earlier draft of this test asserted
    // exactly that and PASSED, which is how a bug gets a regression test
    // guarding it. The rejoin fix may legitimately reconnect mid-window, and
    // that recovery is the subject of the test above. What this one measures is
    // the poll, which `refetchInterval` runs unconditionally either way.
  })
})
