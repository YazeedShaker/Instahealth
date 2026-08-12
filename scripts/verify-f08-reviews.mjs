// F08 — the review write path, proven against LIVE dev.
//
// ⚠ ONE TRANSACTION, ROLLED BACK. Every assertion below writes real rows and
// then destroys them, because "an RLS probe that cannot fail is not a probe"
// (ENGINEERING-WORKFLOW §5): a write aimed at a non-existent id returns "0 rows"
// whether the policy allows it or forbids it, and the two are indistinguishable.
// So the probe creates a REAL review against a REAL completed booking and aims
// its refusals at rows that genuinely exist — then rolls the lot back and
// re-checks from a SEPARATE connection that nothing survived.
//
// Callers are impersonated the way the platform does it: `request.jwt.claims`
// for `auth.uid()`, plus `SET LOCAL ROLE` so GRANTs are evaluated as the real
// role. A SECURITY DEFINER function still runs as its owner — which is the
// point, since the function body is the boundary, not RLS.
//
//   node scripts/verify-f08-reviews.mjs
//
// Needs SUPABASE_DB_URL in apps/web/.env.local (the session pooler).

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

function connect() {
  return new pg.Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  })
}

/** Run `fn` with `auth.uid()` = uid and the given Postgres role. */
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

/** Call an RPC and return its JSONB result, or the SQLSTATE if it raised.
 *
 * ⚠ EACH CALL GETS ITS OWN SAVEPOINT. Half the assertions here are supposed to
 * RAISE — a revoked GRANT is a `42501`, which is the signal we are looking for —
 * and in Postgres a raised error poisons the whole transaction: every later
 * statement returns `25P02 current transaction is aborted` until a rollback. So
 * a probe built to observe refusals will observe exactly one and then report
 * garbage for the rest. The savepoint contains each refusal to itself. */
let savepointCounter = 0
async function call(client, sql, params) {
  const point = `probe_${(savepointCounter += 1)}`
  await client.query(`SAVEPOINT ${point}`)
  try {
    const { rows } = await client.query(sql, params)
    await client.query(`RELEASE SAVEPOINT ${point}`)
    return { ok: true, value: rows[0]?.result ?? rows[0] }
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${point}`)
    return { ok: false, code: error.code, message: error.message }
  }
}

const client = connect()
await client.connect()

let fixtures
try {
  await client.query('BEGIN')

  // ── Fixtures: REAL rows, one per eligibility branch ──────────────────────
  const { rows: picked } = await client.query(`
    WITH ranked AS (
      SELECT b.id, b.user_id, b.branch_id, b.status,
             ROW_NUMBER() OVER (PARTITION BY b.status, b.user_id ORDER BY b.created_at DESC) AS rn
        FROM bookings b
       WHERE NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)
    )
    SELECT * FROM ranked WHERE rn <= 4`)

  const byStatus = (status, userId) =>
    picked.filter((r) => r.status === status && (userId === undefined || r.user_id === userId))

  const completed = byStatus('completed')
  const patientA = completed[0]?.user_id
  const otherCompleted = completed.find((r) => r.user_id !== patientA)

  fixtures = {
    patientA,
    patientB: otherCompleted?.user_id ?? null,
    completedA: completed.find((r) => r.user_id === patientA),
    completedA2: completed.filter((r) => r.user_id === patientA)[1],
    completedB: otherCompleted,
    noShowA: byStatus('no_show', patientA)[0] ?? byStatus('no_show')[0],
    cancelledA: byStatus('cancelled', patientA)[0],
    confirmedA: byStatus('confirmed', patientA)[0],
  }

  // ⚠ A MISSING STATE IS MANUFACTURED, NEVER SKIPPED. Dev does not always hold
  // one booking of every status per patient — today it has four `confirmed`
  // bookings and none of them belong to the patient with the completed ones.
  // Skipping that row would make the eligibility matrix pass by testing
  // nothing, so instead a SPARE booking of this patient's is moved into the
  // missing status INSIDE the transaction. The row is genuinely real when the
  // assertion runs against it, and the rollback takes it back.
  const spares = picked.filter(
    (r) =>
      r.user_id === patientA && ![fixtures.completedA?.id, fixtures.completedA2?.id].includes(r.id),
  )
  for (const key of ['noShowA', 'cancelledA', 'confirmedA']) {
    const wanted = { noShowA: 'no_show', cancelledA: 'cancelled', confirmedA: 'confirmed' }[key]
    if (fixtures[key] !== undefined && fixtures[key] !== null && fixtures[key].user_id === patientA)
      continue
    const spare = spares.shift()
    if (spare === undefined) {
      throw new Error(
        `FIXTURE TRIPWIRE: dev has no spare booking for ${patientA} to stage as ${wanted}. ` +
          'This probe asserts refusals against REAL rows; without one it would pass by ' +
          'matching nothing, which is exactly the failure §5 warns about.',
      )
    }
    await client.query('UPDATE bookings SET status=$1 WHERE id=$2', [wanted, spare.id])
    fixtures[key] = { ...spare, status: wanted }
    check(
      `fixture: staged a real booking of this patient as «${wanted}» (rolled back)`,
      true,
      spare.id,
    )
  }

  const missing = Object.entries(fixtures)
    .filter(([, v]) => v === undefined || v === null)
    .map(([k]) => k)
  if (missing.length > 0) {
    throw new Error(
      `FIXTURE TRIPWIRE: dev has no booking for ${missing.join(', ')}. ` +
        'This probe asserts refusals against REAL rows; without them it would ' +
        'pass by matching nothing, which is exactly the failure §5 warns about.',
    )
  }

  const ADMIN = 'cccc0000-0000-4000-8000-0000000000f1' // seed 007's admin
  const A = fixtures.patientA
  const B = fixtures.patientB

  // ── ① The display-name rule ──────────────────────────────────────────────
  for (const [input, expected] of [
    ['أحمد محمود سعيد', 'أحمد س.'],
    ['منى عبد الرحمن', 'منى ا.'],
    ['سارة', 'سارة'],
    ['', 'مريض'],
    [null, 'مريض'],
  ]) {
    const { rows } = await client.query('SELECT compose_review_display_name($1) AS result', [input])
    check(
      `display name: ${input === null ? 'NULL' : `"${input}"`} → «${expected}»`,
      rows[0].result === expected,
      rows[0].result,
    )
  }

  // ── ② The eligibility matrix — every refusal against a REAL booking ──────
  const submit = (uid, bookingId, rating = 5, comment = null) =>
    as(client, uid, 'authenticated', () =>
      call(client, 'SELECT submit_review($1,$2,$3) AS result', [bookingId, rating, comment]),
    )

  for (const [label, uid, booking, expected] of [
    ['a booking that is not completed (no_show)', A, fixtures.noShowA.id, 'booking_not_completed'],
    ['a cancelled booking', A, fixtures.cancelledA.id, 'booking_not_completed'],
    [
      'a confirmed booking — the visit has not happened',
      A,
      fixtures.confirmedA.id,
      'booking_not_completed',
    ],
    ["ANOTHER patient's completed booking", A, fixtures.completedB.id, 'booking_not_found'],
  ]) {
    const r = await submit(uid, booking)
    check(
      `refused: ${label}`,
      r.ok && r.value?.ok === false && r.value?.error === expected,
      JSON.stringify(r.value ?? r.message),
    )
  }

  for (const rating of [0, 6, null]) {
    const r = await submit(A, fixtures.completedA.id, rating)
    check(
      `refused: rating ${rating === null ? 'NULL' : rating}`,
      r.ok && r.value?.error === 'invalid_rating',
      JSON.stringify(r.value ?? r.message),
    )
  }

  // Anonymous — `auth.uid()` NULL is ANON, not a trusted bypass (§5).
  const anon = await as(client, null, 'anon', () =>
    call(client, 'SELECT submit_review($1,$2,$3) AS result', [fixtures.completedA.id, 5, null]),
  )
  check(
    'refused: the anon key cannot execute submit_review at all',
    anon.ok === false && anon.code === '42501',
    anon.code ?? JSON.stringify(anon.value),
  )

  // ── ③ The happy path, and what it derives ────────────────────────────────
  const branchId = fixtures.completedA.branch_id
  const before = (
    await client.query('SELECT rating, review_count FROM branches WHERE id=$1', [branchId])
  ).rows[0]

  const created = await submit(A, fixtures.completedA.id, 4, '  خدمة ممتازة  ')
  check(
    'accepted: the owner of a completed booking may review it once',
    created.ok && created.value?.ok === true,
    JSON.stringify(created.value ?? created.message),
  )
  const reviewId = created.value?.review_id

  const stored = (
    await client.query(
      'SELECT user_id, branch_id, rating, comment, display_name, is_verified, is_flagged FROM reviews WHERE id=$1',
      [reviewId],
    )
  ).rows[0]
  check(
    'derived: user_id and branch_id come from the booking, never the client',
    stored.user_id === A && stored.branch_id === branchId,
    `${stored.user_id} / ${stored.branch_id}`,
  )
  check(
    'derived: is_verified TRUE, is_flagged FALSE',
    stored.is_verified === true && stored.is_flagged === false,
    `${stored.is_verified}/${stored.is_flagged}`,
  )
  check('stored: the comment is trimmed', stored.comment === 'خدمة ممتازة', `"${stored.comment}"`)
  check(
    'stored: the display name is materialised, not joined',
    typeof stored.display_name === 'string' && stored.display_name.length > 0,
    stored.display_name,
  )

  // A second attempt on the SAME booking.
  const twice = await submit(A, fixtures.completedA.id, 5)
  check(
    'refused: a second review for the same booking',
    twice.ok && twice.value?.error === 'already_reviewed',
    JSON.stringify(twice.value),
  )

  // Stars-only is a first-class case — and an empty comment stores as NULL.
  const starsOnly = await submit(A, fixtures.completedA2.id, 5, '   ')
  check(
    'accepted: stars-only, with the empty comment stored as NULL',
    starsOnly.ok && starsOnly.value?.ok === true,
    JSON.stringify(starsOnly.value),
  )
  const starsRow = (
    await client.query('SELECT comment FROM reviews WHERE id=$1', [starsOnly.value?.review_id])
  ).rows[0]
  check(
    'stored: a whitespace-only comment is NULL, not ""',
    starsRow.comment === null,
    JSON.stringify(starsRow.comment),
  )

  // ── ④ Aggregates — published only, on insert AND on hide AND on restore ──
  const agg = async (label) => {
    const { rows } = await client.query('SELECT rating, review_count FROM branches WHERE id=$1', [
      branchId,
    ])
    return { label, ...rows[0] }
  }
  const afterInsert = await agg('after insert')
  const sameBranch = starsOnly.value?.ok && fixtures.completedA2.branch_id === branchId
  const expectedCount = Number(before.review_count) + (sameBranch ? 2 : 1)
  check(
    'aggregate: review_count moved on insert',
    Number(afterInsert.review_count) === expectedCount,
    `${before.review_count} → ${afterInsert.review_count} (expected ${expectedCount})`,
  )

  // A non-admin must not be able to moderate.
  const denied = await as(client, A, 'authenticated', () =>
    call(client, 'SELECT admin_set_review_hidden($1,$2,$3,$4) AS result', [
      reviewId,
      true,
      null,
      null,
    ]),
  )
  check(
    'refused: a patient cannot hide a review',
    denied.ok && denied.value?.error === 'not_authorized',
    JSON.stringify(denied.value ?? denied.message),
  )

  const hidden = await as(client, ADMIN, 'authenticated', () =>
    call(client, 'SELECT admin_set_review_hidden($1,$2,$3,$4) AS result', [
      reviewId,
      true,
      'abuse',
      'لغة مسيئة',
    ]),
  )
  check(
    'accepted: an admin can hide a review',
    hidden.ok && hidden.value?.ok === true && hidden.value?.is_published === false,
    JSON.stringify(hidden.value ?? hidden.message),
  )

  const afterHide = await agg('after hide')
  check(
    'aggregate: hiding DROPS the review from the count immediately',
    Number(afterHide.review_count) === expectedCount - 1,
    `${afterInsert.review_count} → ${afterHide.review_count}`,
  )
  check(
    'aggregate: hiding RECOMPUTES the average, it does not merely decrement',
    afterHide.rating !== afterInsert.rating || expectedCount - 1 === 0,
    `${afterInsert.rating} → ${afterHide.rating}`,
  )

  // Hidden is absent from a patient read (RLS), present for an admin.
  const patientSees = await as(client, B, 'authenticated', () =>
    call(client, 'SELECT count(*)::int AS result FROM reviews WHERE id=$1', [reviewId]),
  )
  // ⚠ `call()` unwraps the single `result` column, so a COUNT comes back as a
  // number, not an object — reading `.result` off it yielded `undefined` and
  // failed two assertions whose behaviour was correct all along.
  check(
    'hidden: absent from another patient’s read',
    patientSees.ok && patientSees.value === 0,
    JSON.stringify(patientSees.value),
  )

  const adminSees = await as(client, ADMIN, 'authenticated', () =>
    call(client, 'SELECT count(*)::int AS result FROM reviews WHERE id=$1', [reviewId]),
  )
  check(
    'hidden: still visible to an admin, so moderation has something to act on',
    adminSees.ok && adminSees.value === 1,
    JSON.stringify(adminSees.value),
  )

  // ⚠ The author must still be able to see their OWN hidden review, or the
  // prompt reappears and the UNIQUE constraint refuses the resubmission.
  const mine = await as(client, A, 'authenticated', () =>
    call(client, 'SELECT get_my_review($1) AS result', [fixtures.completedA.id]),
  )
  check(
    'author: get_my_review returns their own HIDDEN review, so the prompt cannot reappear',
    mine.ok && mine.value?.found === true && mine.value?.is_published === false,
    JSON.stringify(mine.value ?? mine.message),
  )

  const idempotent = await as(client, ADMIN, 'authenticated', () =>
    call(client, 'SELECT admin_set_review_hidden($1,$2,$3,$4) AS result', [
      reviewId,
      true,
      null,
      null,
    ]),
  )
  check(
    'idempotent: hiding an already-hidden review writes nothing',
    idempotent.ok && idempotent.value?.unchanged === true,
    JSON.stringify(idempotent.value),
  )

  const restored = await as(client, ADMIN, 'authenticated', () =>
    call(client, 'SELECT admin_set_review_hidden($1,$2,$3,$4) AS result', [
      reviewId,
      false,
      null,
      null,
    ]),
  )
  check(
    'accepted: an admin can restore a hidden review',
    restored.ok && restored.value?.ok === true && restored.value?.is_published === true,
    JSON.stringify(restored.value ?? restored.message),
  )

  const afterRestore = await agg('after restore')
  check(
    'aggregate: restoring returns the review to the count',
    Number(afterRestore.review_count) === expectedCount,
    `${afterHide.review_count} → ${afterRestore.review_count}`,
  )

  const history = (
    await client.query(
      'SELECT action, reason_code, reason_note, changed_by FROM review_moderation_history WHERE review_id=$1 ORDER BY changed_at',
      [reviewId],
    )
  ).rows
  check(
    'audit: one row per real change — hidden then restored, attributed to the admin',
    history.length === 2 &&
      history[0].action === 'hidden' &&
      history[0].reason_code === 'abuse' &&
      history[0].changed_by === ADMIN &&
      history[1].action === 'restored',
    JSON.stringify(history),
  )

  // ── ⑤ The GRANT is the ceiling — direct writes are refused ───────────────
  // ⚠ AIMED AT A ROW THAT REALLY EXISTS. RLS denies by filtering rows, so a
  // no-match UPDATE reports success with 0 rows; only a GRANT failure raises
  // 42501. That is the whole reason this targets `reviewId`.
  const directUpdate = await as(client, A, 'authenticated', () =>
    call(client, 'UPDATE reviews SET is_flagged = false WHERE id=$1', [reviewId]),
  )
  check(
    'grant: a patient cannot UPDATE reviews directly — 42501, not a silent no-op',
    directUpdate.ok === false && directUpdate.code === '42501',
    directUpdate.code ?? 'NO ERROR — the write was permitted',
  )

  const directInsert = await as(client, A, 'authenticated', () =>
    call(
      client,
      'INSERT INTO reviews (booking_id, user_id, branch_id, rating) VALUES ($1,$2,$3,$4)',
      [fixtures.completedA2.id, A, branchId, 5],
    ),
  )
  check(
    'grant: a patient cannot INSERT into reviews directly',
    directInsert.ok === false && directInsert.code === '42501',
    directInsert.code ?? 'NO ERROR — the write was permitted',
  )

  const anonUpdate = await as(client, null, 'anon', () =>
    call(client, 'UPDATE reviews SET rating = 1 WHERE id=$1', [reviewId]),
  )
  check(
    'grant: the anon key cannot UPDATE reviews',
    anonUpdate.ok === false && anonUpdate.code === '42501',
    anonUpdate.code ?? 'NO ERROR — the write was permitted',
  )
} finally {
  await client.query('ROLLBACK').catch(() => {})
  await client.end()
}

// ── ⑥ Residue, from a SEPARATE connection ──────────────────────────────────
// The rollback is asserted, not assumed.
const auditor = connect()
await auditor.connect()
try {
  const { rows } = await auditor.query('SELECT count(*)::int AS n FROM reviews')
  check('residue: no review survived the rollback', rows[0].n === 0, `${rows[0].n} rows`)
  const { rows: h } = await auditor.query(
    'SELECT count(*)::int AS n FROM review_moderation_history',
  )
  check('residue: no moderation history survived', h[0].n === 0, `${h[0].n} rows`)
  const { rows: b } = await auditor.query(
    'SELECT count(*)::int AS n FROM branches WHERE review_count <> 0 OR rating IS NULL',
  )
  check(
    'residue: every branch aggregate is back where it started',
    b[0].n === 0,
    `${b[0].n} branches moved`,
  )
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
