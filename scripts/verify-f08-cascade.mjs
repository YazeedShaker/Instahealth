import { readFileSync } from 'node:fs'
import pg from 'pg'
const env = {}
for (const l of readFileSync('F:/Instahealth/Instahealth App/apps/web/.env.local', 'utf8').split(
  /\r?\n/,
)) {
  const t = l.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i < 0) continue
  env[t.slice(0, i).trim()] = t
    .slice(i + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
}
const c = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
const R = []
const ck = (n, ok, d) => R.push([n, ok, String(d)])
await c.query('BEGIN')
try {
  const {
    rows: [bk],
  } = await c.query(
    `select b.id, b.user_id, b.branch_id from bookings b
      where not exists (select 1 from reviews r where r.booking_id=b.id)
        and not exists (select 1 from payments p where p.booking_id=b.id) limit 1`,
  )
  const {
    rows: [rv],
  } = await c.query(
    `insert into reviews (booking_id,user_id,branch_id,rating,display_name,is_verified,is_flagged)
     values ($1,$2,$3,5,'مريض تجريبي',true,false) returning id`,
    [bk.id, bk.user_id, bk.branch_id],
  )
  const before = (await c.query('select review_count from branches where id=$1', [bk.branch_id]))
    .rows[0].review_count
  // Relative, not absolute — dev already carries real reviews from manual testing.
  ck('aggregate counted the new review', Number(before) >= 1, before)
  // ⚠ THE ACTUAL REGRESSION: seed 004 deletes bookings. Before the fix this raised 23503.
  await c.query('delete from bookings where id=$1', [bk.id])
  const gone = (await c.query('select count(*)::int n from reviews where id=$1', [rv.id])).rows[0].n
  ck('deleting the booking CASCADED the review away', gone === 0, `${gone} rows left`)
  const after = (await c.query('select review_count from branches where id=$1', [bk.branch_id]))
    .rows[0].review_count
  ck(
    'and the branch aggregate followed it down',
    Number(after) === Number(before) - 1,
    `${before} -> ${after}`,
  )
} catch (e) {
  ck('cascade delete', false, e.code + ' ' + e.message)
} finally {
  await c.query('ROLLBACK').catch(() => {})
}
const {
  rows: [r],
} = await c.query(`select count(*)::int n from reviews`)
ck('residue: rolled back', true, r.n + ' reviews on dev')
await c.end()
let f = 0
for (const [n, ok, d] of R) {
  if (!ok) f++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  — ${d}`)
}
console.log(`\n${R.length - f}/${R.length} passed`)
process.exit(f ? 1 : 0)
