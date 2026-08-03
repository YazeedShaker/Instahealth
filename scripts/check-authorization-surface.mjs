#!/usr/bin/env node
/**
 * THE AUTHORIZATION GATE.
 *
 *   node scripts/check-authorization-surface.mjs           # verify, exit 1 on drift
 *   node scripts/check-authorization-surface.mjs --write    # accept the new reality
 *
 * Reads the live catalog via `scripts/authorization-surface.sql` and compares it
 * to `supabase/authorization-surface.json`. Any new policy, grant, writable
 * column or RLS change fails CI until someone writes it down — which turns
 * ENGINEERING-WORKFLOW §5's "audit every policy before merge" from an intention
 * a reviewer has to remember into a diff they cannot miss.
 *
 * The comparison is SEMANTIC (parsed JSON, key-by-key), not textual, so psql
 * formatting differences between machines never show up as false drift.
 *
 * ⚠ THIS IS A DRIFT DETECTOR, NOT A JUDGE. It notices that the surface CHANGED;
 * it has no opinion about whether the surface is good. The baseline it ships
 * with records reality as of the sweep, INCLUDING the known-bad entries listed
 * in PROGRESS under Known risks. Closing those is separate work — the point
 * here is that nothing NEW joins them unnoticed.
 *
 * Requires `psql` and SUPABASE_DB_URL (the SESSION POOLER url — the direct host
 * is IPv6-only and unreachable from GitHub runners).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const QUERY = resolve(HERE, 'authorization-surface.sql')
const BASELINE = resolve(HERE, '..', 'supabase', 'authorization-surface.json')

const write = process.argv.includes('--write')

/** `--from-file <path>` reads a captured surface instead of querying. Exists so
 * the diff and review logic can be exercised WITHOUT a database — psql is not
 * installed on every dev machine, and shipping unrunnable logic to CI is how
 * you discover red there instead of here. */
function readSurface() {
  const fromFile = process.argv.indexOf('--from-file')
  if (fromFile !== -1) {
    const path = process.argv[fromFile + 1]
    if (!path) {
      console.error('--from-file needs a path')
      process.exit(2)
    }
    return JSON.parse(readFileSync(resolve(path), 'utf8'))
  }

  const url = process.env.SUPABASE_DB_URL
  if (!url) {
    console.error(
      'SUPABASE_DB_URL is not set.\n' +
        'It is the SESSION POOLER connection string (…pooler.supabase.com:5432), not the API url\n' +
        'and not the direct host — that one is IPv6-only and unreachable from CI.',
    )
    process.exit(2)
  }
  let raw
  try {
    raw = execFileSync('psql', [url, '--tuples-only', '--no-align', '--file', QUERY], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
  } catch (error) {
    console.error('psql failed — is it installed, and is SUPABASE_DB_URL the pooler url?')
    console.error(String(error.stderr ?? error.message).trim())
    process.exit(2)
  }
  try {
    return JSON.parse(raw)
  } catch {
    console.error('Could not parse the surface as JSON. psql said:\n' + raw.slice(0, 800))
    process.exit(2)
  }
}

/** Flatten to `path → value` so a diff can name exactly what moved.
 *
 * ⚠ Arrays are keyed by IDENTITY, not by index. Indexing by position means
 * inserting one function shifts every later entry and reports a wall of false
 * drift that buries the real change — the opposite of a reviewable diff. A
 * function is identified by its signature, a table by its name, a policy by its
 * name; anything without a natural key falls back to its index. */
const IDENTITY_KEYS = ['signature', 'table', 'policy']

function identify(item, index) {
  if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
    for (const key of IDENTITY_KEYS) {
      if (typeof item[key] === 'string') return item[key]
    }
  }
  return String(index)
}

function flatten(node, path = '', out = new Map()) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => flatten(item, `${path}[${identify(item, index)}]`, out))
  } else if (node !== null && typeof node === 'object') {
    for (const key of Object.keys(node).sort()) {
      flatten(node[key], path === '' ? key : `${path}.${key}`, out)
    }
  } else {
    out.set(path, node)
  }
  return out
}

function diff(baseline, current) {
  const before = flatten(baseline)
  const after = flatten(current)
  const changes = []
  for (const [path, value] of after) {
    if (!before.has(path)) changes.push({ kind: 'ADDED', path, to: value })
    else if (JSON.stringify(before.get(path)) !== JSON.stringify(value)) {
      changes.push({ kind: 'CHANGED', path, from: before.get(path), to: value })
    }
  }
  for (const [path, value] of before) {
    if (!after.has(path)) changes.push({ kind: 'REMOVED', path, from: value })
  }
  return changes
}

/** The human signal. Drift is the gate; this is what a reviewer should look at
 * even when nothing drifted. */
function review(surface) {
  const notes = []
  for (const fn of surface.functions ?? []) {
    if (fn.takesIdentityParameter) {
      notes.push(
        `IDENTITY PARAMETER  ${fn.signature}\n` +
          '    A SECURITY DEFINER function taking who-am-I as an argument (§5). It must\n' +
          "    either DERIVE the value from auth.uid() or VERIFY the caller's claim.",
      )
    }
    if (fn.securityDefiner && /PUBLIC|anon/.test(fn.executeGrants)) {
      notes.push(
        `ANON-EXECUTABLE     ${fn.signature}\n` +
          `    SECURITY DEFINER, granted to ${fn.executeGrants}. Reachable with the public\n` +
          '    anon key alone. Intended for public readers; a hole for anything else.',
      )
    }
    if (fn.securityDefiner && fn.config === '-') {
      notes.push(
        `MUTABLE search_path ${fn.signature}\n    SECURITY DEFINER without SET search_path.`,
      )
    }
  }
  for (const table of surface.tables ?? []) {
    if (!table.rlsEnabled) notes.push(`RLS DISABLED        ${table.table}`)
    const writers = (table.policies ?? []).filter((p) =>
      ['INSERT', 'UPDATE', 'ALL'].includes(p.command),
    )
    for (const policy of writers) {
      const cols = table.writableColumns?.authenticated
      if (Array.isArray(cols) && cols.length > 0) {
        notes.push(
          `COLUMN-BLIND WRITE  ${table.table} · "${policy.policy}" (${policy.command})\n` +
            `    authenticated may write ${cols.length} column(s): ${cols.join(', ')}\n` +
            '    An RLS policy scopes ROWS, never COLUMNS. This is the branches.rating shape.',
        )
      }
    }
  }
  return notes
}

const current = readSurface()

if (write) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n', 'utf8')
  console.log(`Baseline written: ${BASELINE}`)
  console.log(
    `  ${current.tables?.length ?? 0} tables, ${current.functions?.length ?? 0} functions`,
  )
  process.exit(0)
}

let baseline
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch {
  console.error(`No baseline at ${BASELINE}. Create it with --write.`)
  process.exit(2)
}

const changes = diff(baseline, current)
const notes = review(current)

console.log('=== Authorization surface ===')
console.log(`${current.tables?.length ?? 0} tables · ${current.functions?.length ?? 0} functions\n`)

if (notes.length > 0) {
  console.log(`── ${notes.length} standing item(s) worth a reviewer's eye ──`)
  for (const note of notes) console.log(note)
  console.log('')
}

if (changes.length === 0) {
  console.log('✅ No drift — the surface matches the checked-in baseline.')
  process.exit(0)
}

console.log(`❌ THE AUTHORIZATION SURFACE CHANGED — ${changes.length} difference(s):\n`)
for (const change of changes) {
  if (change.kind === 'CHANGED') {
    console.log(
      `  CHANGED ${change.path}\n      from: ${JSON.stringify(change.from)}\n      to:   ${JSON.stringify(change.to)}`,
    )
  } else if (change.kind === 'ADDED') {
    console.log(`  ADDED   ${change.path}\n      ${JSON.stringify(change.to)}`)
  } else {
    console.log(`  REMOVED ${change.path}\n      was: ${JSON.stringify(change.from)}`)
  }
}
console.log(
  '\nIf every line above is intended, re-run with --write and COMMIT the baseline so the\n' +
    'change is reviewable. If any line surprises you, that is the point of this check.',
)
process.exit(1)
