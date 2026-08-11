// ⚠ THE ONE PROOF THAT CANNOT BE ROLLED BACK.
//
// Every other A05 assertion ran inside a transaction. The Edge Function's GoTrue
// half cannot: `createUser`, the ban and the password writes live in an auth
// service Postgres cannot roll back. So this creates a REAL account, drives the
// whole lifecycle through the REAL HTTP endpoint, and deletes it again in a
// `finally` that runs even when an assertion fails.
//
// It must pass before any real partner account is ever created.

import fs from 'node:fs'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs
    .readFileSync('F:/Instahealth/Instahealth App/apps/web/.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ''),
      ]
    }),
)

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const results = []
const rec = (n, p, d) => {
  results.push({ n, p })
  console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`)
}

// A throwaway address that cannot collide with a real partner's.
const STAMP = Date.now().toString(36)
const TEST_EMAIL = `gotrue-probe-${STAMP}@instahealth-test.invalid`
const TEST_NAME = 'حساب اختبار مؤقت'
const CHOSEN_PASSWORD = `Probe-${STAMP}-Aa1!x`

const db = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
const anonClient = (session) =>
  createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(session ? { global: { headers: { Authorization: `Bearer ${session}` } } } : {}),
  })

let providerUserId = null
let authUserId = null

await db.connect()
try {
  // ── seed 006 so the admin password is the known one ─────────────────────
  // (memory: first login is a once-per-account state; a previous admin.spec run
  // leaves it changed. The seed takes a psql variable, so the value is bound as
  // a parameter rather than interpolated into SQL text.)
  const seed = fs
    .readFileSync('F:/Instahealth/Instahealth App/supabase/seeds/006_admin_e2e_account.sql', 'utf8')
    .replaceAll(":'admin_password'", "current_setting('ih.admin_password')")
  await db.query(`select set_config('ih.admin_password', $1, false)`, [env.ADMIN_TEST_PASSWORD])
  await db.query(seed)
  rec('seed 006 applied — the admin password is the known one', true)

  // ── the admin's session ─────────────────────────────────────────────────
  const admin = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: adminAuth, error: adminErr } = await admin.auth.signInWithPassword({
    email: env.ADMIN_TEST_EMAIL,
    password: env.ADMIN_TEST_PASSWORD,
  })
  if (adminErr || !adminAuth.session) throw new Error(`admin sign-in failed: ${adminErr?.message}`)
  const adminToken = adminAuth.session.access_token
  rec('admin signed in against the real auth server', true)

  const callEdge = async (body) => {
    const response = await fetch(`${URL}/functions/v1/admin-staff-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        apikey: ANON,
      },
      body: JSON.stringify(body),
    })
    return { status: response.status, json: await response.json().catch(() => null) }
  }

  const branch = (
    await db.query(
      `select b.id, b.name_ar from branches b join providers p on p.id=b.provider_id
        where coalesce(b.is_active,false) and coalesce(p.is_active,false) limit 1`,
    )
  ).rows[0]

  // ── ① CREATE — the half that has never executed ──────────────────────────
  const created = await callEdge({
    action: 'create',
    name: TEST_NAME,
    email: TEST_EMAIL,
    branchId: branch.id,
  })
  rec(
    '⚠ createUser + provider_users row, over real HTTP',
    created.status === 200 &&
      created.json?.success === true &&
      typeof created.json?.tempPassword === 'string',
    `status=${created.status} hasTemp=${typeof created.json?.tempPassword === 'string'} ttl=${created.json?.ttlHours}`,
  )
  const tempPassword = created.json?.tempPassword
  providerUserId = created.json?.providerUserId
  if (!tempPassword) throw new Error('no temp password returned — cannot continue')

  const row = (
    await db.query(
      `select pu.auth_user_id, pu.name, pu.must_change_password, pu.temp_password_issued_at,
              pu.branch_ids[1] as branch_id, u.email
         from provider_users pu join auth.users u on u.id=pu.auth_user_id where pu.id=$1`,
      [providerUserId],
    )
  ).rows[0]
  authUserId = row?.auth_user_id
  rec(
    'both halves written together — auth user AND provider_users, scoped to the branch',
    row?.email === TEST_EMAIL &&
      row?.must_change_password === true &&
      row?.branch_id === branch.id &&
      row?.temp_password_issued_at !== null,
    `email=${row?.email === TEST_EMAIL} mustChange=${row?.must_change_password} branch=${row?.branch_id === branch.id}`,
  )

  rec(
    'the temp password is shaped as the frame draws it and avoids ambiguous glyphs',
    /^[A-Za-z]{2,6}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(tempPassword) &&
      !/[0O1lI]/.test(tempPassword.split('-').slice(1).join('')),
    `shape=${tempPassword.replace(/[A-Za-z0-9]/g, 'x')}`,
  )

  // ── ② the temp password actually logs in ─────────────────────────────────
  const staff = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const first = await staff.auth.signInWithPassword({ email: TEST_EMAIL, password: tempPassword })
  rec(
    'the temp password signs in',
    first.error === null && first.data.session !== null,
    first.error?.message ?? 'ok',
  )

  const stateAfterLogin = await anonClient(first.data.session.access_token).rpc(
    'get_provider_login_state',
  )
  rec(
    '⚠ the forced change FIRES — must_change_password true, not yet expired',
    stateAfterLogin.data?.must_change_password === true &&
      stateAfterLogin.data?.temp_password_expired === false,
    JSON.stringify({
      must: stateAfterLogin.data?.must_change_password,
      exp: stateAfterLogin.data?.temp_password_expired,
    }),
  )

  // ── ③ the change clears the flag, and the new password works ─────────────
  const asStaff = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  await asStaff.auth.signInWithPassword({ email: TEST_EMAIL, password: tempPassword })
  const updated = await asStaff.auth.updateUser({ password: CHOSEN_PASSWORD })
  const completed = await asStaff.rpc('complete_provider_password_change')
  const afterChange = (
    await db.query(
      `select must_change_password, temp_password_issued_at from provider_users where id=$1`,
      [providerUserId],
    )
  ).rows[0]
  rec(
    'changing the password clears the flag and the expiry',
    updated.error === null &&
      completed.data?.success === true &&
      afterChange.must_change_password === false &&
      afterChange.temp_password_issued_at === null,
    `updateErr=${updated.error?.message ?? 'none'} flag=${afterChange.must_change_password}`,
  )

  const withNew = await createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email: TEST_EMAIL, password: CHOSEN_PASSWORD })
  rec(
    'the NEW password signs in',
    withNew.error === null && withNew.data.session !== null,
    withNew.error?.message ?? 'ok',
  )

  const oldRejected = await createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email: TEST_EMAIL, password: tempPassword })
  rec(
    'the OLD temp password is now refused',
    oldRejected.error !== null,
    oldRejected.error?.message ?? 'STILL ACCEPTED',
  )

  // ── ④ the 72-hour rule, against a backdated fixture ──────────────────────
  await db.query(
    `update provider_users set must_change_password=true,
            temp_password_issued_at = now() - interval '73 hours' where id=$1`,
    [providerUserId],
  )
  const stale = await createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const staleSignIn = await stale.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: CHOSEN_PASSWORD,
  })
  const staleState = await anonClient(staleSignIn.data.session.access_token).rpc(
    'get_provider_login_state',
  )
  rec(
    '⚠ an UNUSED temp older than 72h is reported expired — the portal refuses it',
    staleState.data?.temp_password_expired === true,
    `expired=${staleState.data?.temp_password_expired}`,
  )

  // ── ⑤ regenerate invalidates the old ─────────────────────────────────────
  const regen = await callEdge({ action: 'regenerate_temp', providerUserId })
  const newTemp = regen.json?.tempPassword
  rec(
    'regenerate returns a fresh temp password',
    regen.status === 200 && typeof newTemp === 'string' && newTemp !== tempPassword,
    `status=${regen.status}`,
  )

  const chosenNowDead = await createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email: TEST_EMAIL, password: CHOSEN_PASSWORD })
  rec(
    '⚠ regenerating INVALIDATES the previous password',
    chosenNowDead.error !== null,
    chosenNowDead.error?.message ?? 'STILL ACCEPTED',
  )

  const withRegen = await createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email: TEST_EMAIL, password: newTemp })
  rec(
    'the regenerated temp password signs in',
    withRegen.error === null,
    withRegen.error?.message ?? 'ok',
  )

  // ── ⑥ disable locks the account out at the auth server ───────────────────
  const disabled = await callEdge({ action: 'disable', providerUserId })
  const afterDisable = (
    await db.query(
      `select pu.is_active, u.banned_until from provider_users pu join auth.users u on u.id=pu.auth_user_id where pu.id=$1`,
      [providerUserId],
    )
  ).rows[0]
  const bannedLogin = await createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email: TEST_EMAIL, password: newTemp })
  rec(
    '⚠ disable bans at GoTrue AND deactivates the row — sign-in refused',
    disabled.json?.success === true &&
      afterDisable.is_active === false &&
      afterDisable.banned_until !== null &&
      bannedLogin.error !== null,
    `isActive=${afterDisable.is_active} banned=${afterDisable.banned_until !== null} signIn=${bannedLogin.error?.message ?? 'STILL ACCEPTED'}`,
  )

  // ── ⑦ enable reverses it with a fresh temp ───────────────────────────────
  const enabled = await callEdge({ action: 'enable', providerUserId })
  const reLogin = await createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email: TEST_EMAIL, password: enabled.json?.tempPassword })
  rec(
    'enable un-bans and issues a fresh temp that works',
    enabled.json?.success === true &&
      typeof enabled.json?.tempPassword === 'string' &&
      reLogin.error === null,
    `status=${enabled.status} signIn=${reLogin.error?.message ?? 'ok'}`,
  )

  // ── ⑧ a duplicate address is refused, not half-created ───────────────────
  const dup = await callEdge({
    action: 'create',
    name: TEST_NAME,
    email: TEST_EMAIL,
    branchId: branch.id,
  })
  rec(
    'a duplicate email is refused as email_taken',
    dup.json?.error === 'email_taken',
    `status=${dup.status} error=${dup.json?.error}`,
  )

  // ── ⑨ a non-admin cannot reach the function at all ───────────────────────
  const provider = await createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({
    email: env.PROVIDER_TEST_EMAIL,
    password: env.PROVIDER_TEST_PASSWORD,
  })
  if (provider.data?.session) {
    const asProvider = await fetch(`${URL}/functions/v1/admin-staff-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.data.session.access_token}`,
        apikey: ANON,
      },
      body: JSON.stringify({ action: 'disable', providerUserId }),
    })
    const body = await asProvider.json().catch(() => null)
    rec(
      '⚠ a PROVIDER session is refused 403 by the Edge Function itself',
      asProvider.status === 403 && body?.error === 'not_authorized',
      `status=${asProvider.status} error=${body?.error}`,
    )
  } else {
    rec('provider-denied probe', false, `could not sign in as provider: ${provider.error?.message}`)
  }
} catch (err) {
  rec('probe crashed', false, err.message)
} finally {
  // ⚠ CLEANUP RUNS EVEN ON FAILURE. This account is real; leaving it behind
  // would put a live credential for a live branch on the dev database.
  try {
    if (providerUserId)
      await db.query(`delete from provider_user_history where provider_user_id=$1`, [
        providerUserId,
      ])
    if (providerUserId) await db.query(`delete from provider_users where id=$1`, [providerUserId])
    if (authUserId) await db.query(`delete from auth.users where id=$1`, [authUserId])
    const left = (
      await db.query(`select count(*)::int n from auth.users where email=$1`, [TEST_EMAIL])
    ).rows[0].n
    rec('the test account is GONE — no residue', left === 0, `remainingRows=${left}`)
  } catch (e) {
    rec('cleanup failed — MANUAL DELETION REQUIRED', false, `${TEST_EMAIL}: ${e.message}`)
  }
  await db.end()
}

const failed = results.filter((r) => !r.p)
console.log(
  `\n=== ${results.length - failed.length}/${results.length} passed, ${failed.length} failed ===`,
)
if (failed.length) process.exit(1)
