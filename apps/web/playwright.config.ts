import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from '@playwright/test'

// Load .env.local into THIS process.
//
// Next.js loads it for the app, but Playwright's own runner is a separate
// process and never saw it — so the E2E header's "Local: set
// PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD in apps/web/.env.local"
// instruction silently did nothing, and the dashboard suite skipped locally
// while passing in CI (where the secrets arrive as job env vars). Found while
// capturing the P02 fidelity screenshots.
//
// CI values always win: a developer's local file must never override a secret.
function loadEnvLocal(): void {
  try {
    const contents = readFileSync(resolve(__dirname, '.env.local'), 'utf8')
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (trimmed.length === 0 || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator === -1) continue
      const key = trimmed.slice(0, separator).trim()
      if (process.env[key] !== undefined) continue
      process.env[key] = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
    }
  } catch {
    // No .env.local (CI, or a fresh clone) — the suites that need credentials
    // skip themselves, which is the honest behaviour.
  }
}

loadEnvLocal()

/** CI always uses the real build; locally it is opt-in. Defined once so the
 * COMMAND and its TIMEOUT can never disagree — a dev-length budget against a
 * cold `next build` would read as a hung server rather than a short budget. */
const USE_PRODUCTION_BUILD = process.env.CI !== undefined || process.env.E2E_PROD === '1'

export default defineConfig({
  testDir: './e2e',
  // Fidelity captures are a LOCAL AUTHORING TOOL, not a test suite — their own
  // header says so: run them, commit the images, put them in the PR body. They
  // assert almost nothing. In CI they were the slowest thing in the job (a login
  // and a navigation each), competed with the real specs for one dev server,
  // and wrote screenshots into a container where nobody would ever look at them
  // — while being the only thing turning the job red. Excluding them removes
  // no coverage: every real assertion lives in dashboard.spec.ts.
  //
  //   pnpm --filter @instahealth/web exec playwright test fidelity
  testIgnore: process.env.CI ? ['**/fidelity.spec.ts'] : [],
  // Playwright's 30s default is not enough here: every dashboard test signs in
  // and then waits on a SERVER-rendered fetch against the remote dev database,
  // with three workers contending for one dev server. A 30s inner assertion
  // inside a 30s test can never pass — the test dies first, and it looks like
  // a missing element rather than a budget problem.
  //
  // CI is markedly slower than a local run — a GitHub runner reaching Supabase
  // in Frankfurt, cold, is nothing like localhost. These two failed in CI while
  // passing locally, which is exactly the signal that the budget was tuned to
  // the wrong machine.
  timeout: 120_000,
  expect: {
    // 5s (the default) does not cover a DEBOUNCED query plus a round trip to a
    // remote database. Assertions here routinely wait on both, so the realistic
    // floor is much higher — a slow assertion is not a failing one.
    timeout: 15_000,
  },
  // ⚠ QUIET IN CI. `dot` keeps the summary line — "60 passed", "9 skipped" —
  // which is the number §9 insists on reading, and drops the per-test line that
  // made a green run ~70 lines of log. The HTML report is still written, so a
  // FAILURE is fully inspectable as an artifact.
  reporter: process.env.CI
    ? [['html', { outputFolder: 'playwright-report', open: 'never' }], ['dot']]
    : [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    // ⚠ CI RUNS AGAINST A PRODUCTION BUILD, because `next dev` CANNOT show a
    // whole class of Router-Cache bug this dashboard has already shipped twice.
    //
    // The concrete case: after recording an outcome, coming back to Today
    // repainted the PRE-ACTION snapshot — the chip reverted and «وصل» reappeared
    // on a booking the database considered completed. Next serves back/forward
    // (and, in a production build, ordinary in-app navigation) from the client
    // Router Cache; `export const dynamic = 'force-dynamic'` only stops SERVER
    // caching, which is the trap — the page looks correctly configured.
    //
    // Measured, sampling 10s after coming back:
    //   production, unfixed → stale the whole sample, ZERO refetches
    //   production, fixed   → corrects in ~280ms
    //   `next dev`, either  → corrects in ~295ms; the bug CANNOT occur
    //
    // That last row is why this matters: the regression test passed with AND
    // without the fix under `pnpm dev`, i.e. a guard with no teeth in the only
    // place it runs automatically. Proven the other way too — `E2E_PROD=1` with
    // the fix reverted fails `Expected "completed", Received "confirmed"`.
    //
    // Cost is negative: the suite is FASTER against the build (1.1m vs 1.8m — no
    // on-demand compilation), plus ~40s to build.
    //
    // Locally the default stays `pnpm dev` for a fast authoring loop; opt in with
    // `E2E_PROD=1 pnpm test:e2e` when touching navigation, caching or realtime.
    command: USE_PRODUCTION_BUILD ? 'pnpm build && pnpm start' : 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // A cold `next build` on a runner needs materially more than a dev boot.
    timeout: USE_PRODUCTION_BUILD ? 420_000 : 180_000,
  },
})
