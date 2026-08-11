#!/usr/bin/env node
// Regenerates packages/core/src/types/database.ts from the live dev project.
//
// WHY THIS IS A SCRIPT AND NOT A ONE-LINER: the old form was
//   supabase gen types typescript --project-id … > packages/core/src/types/database.ts
// The shell creates (and TRUNCATES) the redirect target BEFORE running the
// command — so when `supabase` isn't on PATH, the command fails and
// database.ts is silently left EMPTY. That is a 967-line file the whole
// workspace typechecks against. Generate to a temp buffer, sanity-check it,
// and only then overwrite.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ID = 'yesxxpkyelhyojkxgmcb'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = path.join(ROOT, 'packages/core/src/types/database.ts')

// A valid generation always contains these; anything shorter is a failure.
const REQUIRED_MARKERS = ['export type Database = {', 'confirm_booking', 'export type Tables<']
const MIN_BYTES = 10_000

function generate() {
  const args = ['--yes', 'supabase', 'gen', 'types', 'typescript', '--project-id', PROJECT_ID]
  try {
    return execFileSync('npx', args, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
      shell: process.platform === 'win32',
    })
  } catch (error) {
    console.error(
      '\ngen:types failed. Install the CLI (`pnpm add -D supabase -w`) or use the\n' +
        'Supabase MCP `generate_typescript_types` tool and paste the result into\n' +
        `${path.relative(ROOT, TARGET)}.\n`,
    )
    throw error
  }
}

const output = generate()

if (output.length < MIN_BYTES || !REQUIRED_MARKERS.every((marker) => output.includes(marker))) {
  console.error('gen:types produced implausible output — refusing to overwrite database.ts.')
  process.exit(1)
}

// ⚠ READ, DON'T ASK-THEN-READ. `existsSync()` followed by `readFileSync()` is a
// time-of-check/time-of-use race: the file can vanish between the two calls and
// the read throws. CodeQL has flagged it as `js/file-system-race` since
// 2026-07-29; it surfaced as a PR blocker the first time an unrelated change
// added another file under `scripts/`, which pulled the directory into the
// pull request's diff scope. Fixed rather than dismissed — one read, and a
// missing file is simply "no previous content".
let previous = ''
try {
  previous = fs.readFileSync(TARGET, 'utf8')
} catch {
  // No previous file, or it disappeared mid-run. Either way there is nothing to
  // compare against, and the write below is still correct.
}
fs.writeFileSync(TARGET, output)
console.log(
  previous === output
    ? 'database.ts is byte-identical (no schema-visible change).'
    : 'database.ts updated.',
)
