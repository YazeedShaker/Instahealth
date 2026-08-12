// F08 (reads) — the branch summary, the review list, and the provider figure.
//
// ⚠ ONE TRANSACTION, ROLLED BACK, residue re-checked from a separate
// connection — same discipline as `verify-f08-reviews.mjs`, which proves the
// WRITE path. This one proves the two claims that could each be wrong in a way
// no screenshot would reveal:
//
//   ① The provider average is the weighted mean of review ROWS, not the mean of
//      branch averages. The fixture below is built so those two are DIFFERENT
//      numbers (3.0 vs 3.5) — a probe where they coincide proves nothing.
//   ② An ADMIN sees the same aggregate a patient sees. The RLS policy is
//      `is_flagged = false OR get_user_role() = 'admin'`, so a function that
//      inherited its predicate from RLS would quietly compute a different
//      average for the founder than for every patient.
//
// Reviews are inserted DIRECTLY here rather than through `submit_review`, on
// purpose: the writer is already proven 41/41 elsewhere, and going around it is
// the only way to construct an exact rating distribution across two branches.
//
//   node scripts/verify-f08-reads.mjs

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const env = {}
  for (const line of readFileSync(resolve(ROOT, 'apps/web/.env.local'), 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    env[trimmed.slice(0, separator).trim()] = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadEnv()
const results = []
const check = (name, ok, detail) => results.push({ name, ok, detail: String(detail) })
const connect = () =>
  new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })

const ADMIN = 'cccc0000-0000-4000-8000-0000000000f1'

async function as(client, uid, role, fn) {
  await client.query('SELECT set_config($1, $2, true)', [
    'request.jwt.claims',
    uid === null ? '' : JSON.stringify({ sub: uid, role, aal: 'aal2' }),
  ])
  await client.query(`SET LOCAL ROLE ${role}`)
  try {
    return await fn()
  } finally {
    await client.query('RESET ROLE')
  }
}

const client = connect()
await client.connect()
try {
  await client.query('BEGIN')

  // ── Fixture: two branches of ONE provider, with UNEQUAL review counts ─────
  const { rows: pair } = await client.query(`
    SELECT b.provider_id, b.id AS branch_id
      FROM branches b
     WHERE b.is_active
       AND b.provider_id IN (
         SELECT provider_id FROM branches WHERE is_active GROUP BY provider_id HAVING COUNT(*) >= 2
       )
     ORDER BY b.provider_id, b.name_ar
     LIMIT 2`)
  if (pair.length < 2) throw new Error('FIXTURE TRIPWIRE: no provider with two active branches')
  const providerId = pair[0].provider_id
  const branchA = pair[0].branch_id
  const branchB = pair[1].branch_id

  const { rows: bookings } = await client.query(`
    SELECT b.id, b.user_id FROM bookings b
     WHERE NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)
     LIMIT 4`)
  if (bookings.length < 4) throw new Error('FIXTURE TRIPWIRE: fewer than 4 un-reviewed bookings')

  // Branch A: one 5★. Branch B: two 2★ (one of which we later hide).
  //   mean of branch averages = (5 + 2) / 2 = 3.5
  //   weighted mean of rows   = (5 + 2 + 2) / 3 = 3.0     ← the correct answer
  const plan = [
    [bookings[0], branchA, 5],
    [bookings[1], branchB, 2],
    [bookings[2], branchB, 2],
  ]
  const ids = []
  for (const [booking, branchId, rating] of plan) {
    const { rows } = await client.query(
      `INSERT INTO reviews (booking_id, user_id, branch_id, rating, display_name, is_verified, is_flagged)
       VALUES ($1,$2,$3,$4,'مريض تجريبي',TRUE,FALSE) RETURNING id`,
      [booking.id, booking.user_id, branchId, rating],
    )
    ids.push(rows[0].id)
  }

  const summary = async (branchId, uid = null, role = 'anon') =>
    as(client, uid, role, async () => {
      const { rows } = await client.query('SELECT get_branch_review_summary($1) AS r', [branchId])
      return rows[0].r
    })

  // ── ① The branch summary ─────────────────────────────────────────────────
  const a = await summary(branchA)
  const b = await summary(branchB)
  check(
    'branch A: one 5★ → average 5.0, count 1',
    Number(a.average) === 5 && a.count === 1,
    JSON.stringify({ avg: a.average, n: a.count }),
  )
  check(
    'branch B: two 2★ → average 2.0, count 2',
    Number(b.average) === 2 && b.count === 2,
    JSON.stringify({ avg: b.average, n: b.count }),
  )
  check(
    'distribution is always five buckets, highest first',
    Array.isArray(b.distribution) && b.distribution.length === 5 && b.distribution[0].stars === 5,
    JSON.stringify(b.distribution?.map((d) => `${d.stars}★:${d.count}`)),
  )
  check(
    'distribution percentages: two of two 2★ is 100%',
    b.distribution?.find((d) => d.stars === 2)?.percent === 100,
    JSON.stringify(b.distribution?.find((d) => d.stars === 2)),
  )

  // ── ② THE WEIGHTED AVERAGE — the assertion that can actually fail ────────
  const provider = await as(client, null, 'anon', async () => {
    const { rows } = await client.query('SELECT get_provider_review_summary($1, NULL, 3) AS r', [
      providerId,
    ])
    return rows[0].r
  })
  const meanOfBranchMeans = (5 + 2) / 2
  check(
    'provider average is the weighted mean of ROWS (3.0), NOT the mean of branch means (3.5)',
    Number(provider.average) === 3 && Number(provider.average) !== meanOfBranchMeans,
    `got ${provider.average}; mean-of-means would be ${meanOfBranchMeans}`,
  )
  check(
    'provider count is every published row across its branches',
    provider.count === 3,
    String(provider.count),
  )

  // ── ③ The exclusion the frame's disclaimer promises ──────────────────────
  const excluding = await as(client, null, 'anon', async () => {
    const { rows } = await client.query('SELECT get_provider_review_summary($1, $2, 3) AS r', [
      providerId,
      branchA,
    ])
    return rows[0].r
  })
  check(
    'excluding the viewed branch removes it from the provider figure — «ولا تُخلط في نجمة الفرع»',
    Number(excluding.average) === 2 && excluding.count === 2,
    JSON.stringify({ avg: excluding.average, n: excluding.count }),
  )
  check(
    "other-branch reviews carry the BRANCH name, which is the frame's entire label",
    Array.isArray(excluding.reviews) &&
      excluding.reviews.every(
        (r) => typeof r.branchNameAr === 'string' && r.branchNameAr.length > 0,
      ),
    JSON.stringify(excluding.reviews?.map((r) => r.branchNameAr)),
  )

  // ── ④ ADMIN PARITY — the predicate is stated, not inherited ──────────────
  await client.query('UPDATE reviews SET is_flagged = TRUE WHERE id = $1', [ids[1]])

  const patientView = await summary(branchB, bookings[1].user_id, 'authenticated')
  const adminView = await summary(branchB, ADMIN, 'authenticated')
  check(
    'after hiding one: a patient sees count 1',
    patientView.count === 1,
    JSON.stringify({ avg: patientView.average, n: patientView.count }),
  )
  check(
    '⚠ an ADMIN sees the SAME count — the RLS bypass does not leak into the aggregate',
    adminView.count === patientView.count &&
      String(adminView.average) === String(patientView.average),
    `admin ${JSON.stringify({ avg: adminView.average, n: adminView.count })} vs patient ${JSON.stringify({ avg: patientView.average, n: patientView.count })}`,
  )

  const adminList = await as(client, ADMIN, 'authenticated', async () => {
    const { rows } = await client.query('SELECT get_branch_reviews($1, 10, 0) AS r', [branchB])
    return rows[0].r
  })
  check(
    "⚠ and the admin's LIST omits the hidden review too",
    Array.isArray(adminList) &&
      adminList.length === 1 &&
      !adminList.some((r) => r.reviewId === ids[1]),
    `${adminList?.length} row(s)`,
  )

  // ── ⑤ The list: shape, order, paging ─────────────────────────────────────
  const listed = await as(client, null, 'anon', async () => {
    const { rows } = await client.query('SELECT get_branch_reviews($1, 10, 0) AS r', [branchA])
    return rows[0].r
  })
  check(
    "list returns the frame's fields",
    listed?.[0] !== undefined &&
      ['reviewId', 'rating', 'comment', 'displayName', 'serviceNameAr', 'createdAt'].every(
        (k) => k in listed[0],
      ),
    JSON.stringify(Object.keys(listed?.[0] ?? {})),
  )
  check(
    'a stars-only review carries comment NULL, which the frame renders as «قيّم بالنجوم بلا تعليق.»',
    listed?.[0]?.comment === null,
    JSON.stringify(listed?.[0]?.comment),
  )

  // ⚠ RESTORE FIRST. The paging check below wants branch B's two rows, and
  // section ④ hid one of them — the first run asserted "a two-row branch" and
  // got 0, which was the function answering CORRECTLY about a one-row branch.
  // A stale premise reads exactly like a bug.
  await client.query('UPDATE reviews SET is_flagged = FALSE WHERE id = $1', [ids[1]])
  const restored = await summary(branchB)
  check(
    'restoring returns the row to the summary the patient sees',
    restored.count === 2 && Number(restored.average) === 2,
    JSON.stringify({ avg: restored.average, n: restored.count }),
  )

  const paged = await as(client, null, 'anon', async () => {
    const { rows } = await client.query('SELECT get_branch_reviews($1, 1, 1) AS r', [branchB])
    return rows[0].r
  })
  check(
    'paging: limit 1 offset 1 on a two-row branch returns one row',
    Array.isArray(paged) && paged.length === 1,
    `${paged?.length} row(s)`,
  )

  const emptyBranch = await as(client, null, 'anon', async () => {
    const { rows } = await client.query(
      `SELECT get_branch_review_summary(id) AS r FROM branches
        WHERE is_active AND id NOT IN ($1,$2) LIMIT 1`,
      [branchA, branchB],
    )
    return rows[0].r
  })
  check(
    '⚠ a branch with no reviews returns average NULL, never 0 — «لا نجمة كاذبة ولا صفر مخيف»',
    emptyBranch.average === null && emptyBranch.count === 0,
    JSON.stringify({ avg: emptyBranch.average, n: emptyBranch.count }),
  )
} finally {
  await client.query('ROLLBACK').catch(() => {})
  await client.end()
}

const auditor = connect()
await auditor.connect()
try {
  const { rows } = await auditor.query('SELECT count(*)::int AS n FROM reviews')
  check('residue: no review survived the rollback', rows[0].n === 0, `${rows[0].n} rows`)
  const { rows: b } = await auditor.query(
    'SELECT count(*)::int AS n FROM branches WHERE review_count <> 0 OR rating IS NULL',
  )
  check('residue: every branch aggregate is back where it started', b[0].n === 0, `${b[0].n} moved`)
} finally {
  await auditor.end()
}

let failed = 0
for (const { name, ok, detail } of results) {
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  — ${detail}`)
}
console.log(`\n${results.length - failed}/${results.length} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
