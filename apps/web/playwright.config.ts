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

export default defineConfig({
  testDir: './e2e',
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
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
