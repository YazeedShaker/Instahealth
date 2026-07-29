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
