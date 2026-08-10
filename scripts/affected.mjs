#!/usr/bin/env node
// Which suites does this change actually need? Answered from the TURBO GRAPH,
// not from hand-maintained path globs.
//
// WHY THE GRAPH AND NOT PATHS. A glob list says "if apps/mobile changed, run
// Maestro". It cannot know that a change to `packages/core` reaches BOTH apps,
// or that `packages/design-tokens` reaches mobile through NativeWind. Turbo
// already models those edges — `--filter=...[<base>]` returns every package
// affected by the diff INCLUDING dependents — so the graph answers correctly and
// stays correct as the workspace changes. A glob list would drift silently, and
// the failure mode of a stale glob is a suite that stops running while CI stays
// green, which is the worst possible failure mode.
//
// ⚠ FAILS OPEN, ALWAYS. Any doubt — turbo errored, the base ref is missing, a
// root file moved — and every suite runs. Skipping a suite is only ever safe
// when we are CERTAIN it could not be affected; the opposite mistake is a
// regression reaching main behind a green check.
//
// Usage:  node scripts/affected.mjs            → prints key=value lines
//         BASE_REF=origin/main node scripts/affected.mjs >> "$GITHUB_OUTPUT"

import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

const base = process.env.BASE_REF?.trim()
const force = process.env.FORCE_ALL === 'true' || !base

/** Root files that can affect ANY package, so a change to one runs everything.
 *
 * ⚠ THIS LIST IS THE WHOLE REASON THE SCRIPT IS NOT JUST `turbo --dry=json`.
 * Turbo reports every root-level file as the pseudo-package `//`, without
 * distinguishing `pnpm-lock.yaml` from `PROGRESS.md`. Since EVERY feature PR
 * touches PROGRESS.md, treating `//` as "run everything" would silently disable
 * the filter on precisely the PRs it exists for. So `//` is classified here:
 * dependency, build or CI config → run everything; anything else at the root
 * (docs, PROGRESS, the checklist) → let the package graph decide.
 */
const GLOBAL_PATHS = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  '.github/workflows/',
  '.nvmrc',
]

function changedFiles(ref) {
  try {
    return execFileSync('git', ['diff', '--name-only', `${ref}...HEAD`], { encoding: 'utf8' })
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch {
    return null
  }
}

function detect() {
  if (force) return { web: true, mobile: true, reason: 'forced (schedule, or no base ref)' }

  const files = changedFiles(base)
  if (files === null) {
    return { web: true, mobile: true, reason: 'could not diff against base — failing open' }
  }
  const global = files.find((f) => GLOBAL_PATHS.some((g) => f === g || f.startsWith(g)))
  if (global !== undefined) {
    return { web: true, mobile: true, reason: `global file changed (${global})` }
  }

  let raw
  try {
    raw = execFileSync('pnpm', ['turbo', 'run', 'build', `--filter=...[${base}]`, '--dry=json'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      shell: process.platform === 'win32',
    })
  } catch (error) {
    return {
      web: true,
      mobile: true,
      reason: `turbo failed (${String(error.message).split('\n')[0]}) — failing open`,
    }
  }

  let packages
  try {
    packages = JSON.parse(raw.slice(raw.indexOf('{'))).packages ?? []
  } catch {
    return { web: true, mobile: true, reason: 'unparseable turbo output — failing open' }
  }

  // `//` is dropped deliberately — the dangerous root files were already
  // classified above, so anything left here is a doc or a log.
  packages = packages.filter((p) => p !== '//')

  return {
    web: packages.includes('@instahealth/web'),
    mobile: packages.includes('@instahealth/mobile'),
    reason: packages.length > 0 ? `affected: ${packages.join(', ')}` : 'no packages affected',
  }
}

const { web, mobile, reason } = detect()
const lines = [`web=${web}`, `mobile=${mobile}`]

console.error(`affected → web=${web} mobile=${mobile}  (${reason})`)
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n')
}
console.log(lines.join('\n'))
