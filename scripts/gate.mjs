#!/usr/bin/env node
// `pnpm gate` — the pre-push sequence, in one command, with one table of output.
//
// WHY THIS EXISTS. The full local sequence is five commands that must run in a
// specific order, and getting the order wrong produces failures that look like
// real ones:
//   · `pnpm format` must precede `format:check` — Prettier REWRITES files, so
//     checking first and formatting second invalidates the check you just did;
//   · `build` must precede `typecheck` — running them concurrently races on
//     `.next/types`, and the error is a wall of `TS6053: File not found` that
//     says nothing about the cause. That cost a debugging round more than once.
// Encoding the order here means nobody has to remember it.
//
// AND WHY THE OUTPUT IS QUIET. The old sequence printed roughly 700 lines of
// turbo/vitest/tsc chatter on a fully GREEN run — coverage tables, per-file
// ticks, cache notices. None of it is read when everything passes, and in an
// agent session all of it is paid for in context. So: one line per step while
// running, a summary table at the end, and the FULL captured output printed
// only for steps that actually failed.
//
// Nothing about what is verified changes. This is the same sequence
// ENGINEERING-WORKFLOW §3 has always specified — see docs/CHECKLIST.md for
// which changes need it.

import { spawn } from 'node:child_process'
import { performance } from 'node:perf_hooks'

const STEPS = [
  // ⚠ ORDER IS LOAD-BEARING — see the header.
  { name: 'format', cmd: 'pnpm', args: ['format'] },
  { name: 'format:check', cmd: 'pnpm', args: ['format:check'] },
  { name: 'build', cmd: 'pnpm', args: ['turbo', 'build', '--force'] },
  { name: 'typecheck', cmd: 'pnpm', args: ['turbo', 'typecheck', '--force'] },
  { name: 'lint', cmd: 'pnpm', args: ['turbo', 'lint', '--force'] },
  { name: 'test:unit', cmd: 'pnpm', args: ['turbo', 'test:unit', '--force'] },
  { name: 'audit', cmd: 'pnpm', args: ['audit', '--audit-level=high'] },
]

const GREEN = '[32m'
const RED = '[31m'
const DIM = '[2m'
const BOLD = '[1m'
const RESET = '[0m'

function run(step) {
  return new Promise((resolve) => {
    const started = performance.now()
    const child = spawn(step.cmd, step.args, {
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    child.on('close', (code) => {
      resolve({
        ...step,
        ok: code === 0,
        code,
        output,
        seconds: (performance.now() - started) / 1000,
      })
    })
  })
}

/** Pull the one line worth showing from a green step — test counts, mostly.
 *  READ THE COUNTS is a standing rule (§9): a skipped suite and a passing suite
 *  look identical in a summary line, so the summary has to carry the number. */
function highlight(step, output) {
  const clean = output.replace(/\[[0-9;]*m/g, '')
  if (step.name === 'test:unit') {
    const totals = [...clean.matchAll(/Tests\s+(\d+) passed(?:\s*\|\s*(\d+) skipped)?/g)]
    const passed = totals.reduce((sum, m) => sum + Number(m[1]), 0)
    const skipped = totals.reduce((sum, m) => sum + Number(m[2] ?? 0), 0)
    if (passed > 0) return `${passed} passed${skipped > 0 ? `, ${skipped} SKIPPED` : ''}`
  }
  if (step.name === 'audit') {
    const found = clean.match(/(\d+) vulnerabilities found/)
    if (found) return `${found[1]} known, none unignored ≥ high`
  }
  if (step.name === 'build' || step.name === 'typecheck' || step.name === 'lint') {
    const tasks = clean.match(/Tasks:\s+(\d+) successful, (\d+) total/)
    if (tasks) return `${tasks[1]}/${tasks[2]} tasks`
  }
  return ''
}

const results = []
let failedEarly = false

for (const step of STEPS) {
  process.stdout.write(`${DIM}· ${step.name}${RESET} `)
  const result = await run(step)
  results.push(result)
  if (result.ok) {
    const note = highlight(step, result.output)
    process.stdout.write(
      `${GREEN}ok${RESET} ${DIM}${result.seconds.toFixed(1)}s${note ? ` · ${note}` : ''}${RESET}\n`,
    )
  } else {
    process.stdout.write(`${RED}FAILED${RESET} ${DIM}${result.seconds.toFixed(1)}s${RESET}\n`)
    failedEarly = true
    // Stop at the first failure. The steps are ordered by cost and by
    // dependency, so everything after a failure is either unrunnable or
    // noise — and a wall of downstream failures buries the real one.
    break
  }
}

console.log('')
console.log(`${BOLD}  step           result${RESET}`)
console.log(`${DIM}  ─────────────  ──────────────────────────────────────${RESET}`)
for (const r of results) {
  const mark = r.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
  const note = r.ok ? highlight(r, r.output) : `exit ${r.code}`
  console.log(`  ${mark} ${r.name.padEnd(13)} ${DIM}${r.seconds.toFixed(1)}s${RESET}  ${note}`)
}
const skippedSteps = STEPS.slice(results.length)
for (const s of skippedSteps) {
  console.log(`  ${DIM}– ${s.name.padEnd(13)} not run${RESET}`)
}
console.log('')

if (failedEarly) {
  const failure = results[results.length - 1]
  console.log(`${RED}${BOLD}${failure.name} failed — full output below.${RESET}\n`)
  console.log(failure.output.trimEnd())
  console.log('')
  console.log(
    `${RED}Gate FAILED at ${failure.name}.${RESET} ` + `${DIM}Steps after it were not run.${RESET}`,
  )
  process.exit(1)
}

const total = results.reduce((sum, r) => sum + r.seconds, 0)
console.log(`${GREEN}${BOLD}Gate PASSED${RESET} ${DIM}in ${total.toFixed(0)}s.${RESET}`)
console.log(
  `${DIM}This is the MERGE gate, not the edit gate — see docs/CHECKLIST.md for` +
    ` which tier of change needs what.${RESET}`,
)
