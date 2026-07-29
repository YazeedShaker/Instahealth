# DECISION — Booking outcome lifecycle & auto-close

> Ratified 2026-07-28. Answers the first of the two open business questions
> raised in F07 and implemented in P01. Referenced by
> `supabase/migrations/20260728200351_auto_close_stale_bookings_with_system_discriminator.sql`.

---

## The question

Who marks a booking's outcome, and what happens to the ones nobody touches?

Before P01 nothing ever wrote `completed` or `no_show`. Bookings sat `confirmed`
forever, which made the patient's «السابقة» tab lie and left F09 reviews — which
hang off a completed booking — with nothing to attach to.

## The decision

**1 · The receptionist marks the outcome.** The desk is the only party that
knows what actually happened. P01 gives them `confirmed → arrived → completed`
and `→ no_show`, enforced server-side by `mark_booking_outcome`.

**2 · A nightly job closes what the desk never touched — never silently, never
punitively.** `auto_close_stale_bookings()` runs at 02:30 Cairo and moves any
still-`confirmed`/`arrived` booking whose slot ended **more than 24 hours ago**
to `no_show`.

Three rules make that acceptable:

- **The 24-hour grace is the point.** The desk gets a full day to fix yesterday
  honestly before the system guesses. Closing at midnight would race the evening
  shift's paperwork.
- **A system guess is ALWAYS distinguishable from a human judgement.** `closed_by` is
  `'system'` for the cron and `'provider'`/`'admin'` for a person, mirroring the
  existing `cancelled_by` discriminator. **Any future patient-reputation or
  reliability metric MUST exclude `closed_by = 'system'`** — a patient who
  attended but whose desk forgot to click must never be penalised for our
  automation. This is why the column exists at all.
- **Money is never invented.** An auto-closed **cash** booking keeps
  `payment_status = 'cash'` and its `payments` row stays `pending`. Nobody
  collected anything. Only a human marking `completed` is treated as the
  collection event (see `DECISION-commission-attachment.md`).

## Why not the alternatives

- **Leave them open forever** — the patient's history lies, and reviews have no
  anchor. Rejected.
- **Close at the slot's end time** — races the desk. A busy branch marks
  arrivals in a lull, not at the minute. Rejected.
- **Route the cron through `mark_booking_outcome`** — it would reuse the
  transition guards, but the whole value of `closed_by` is telling a human
  decision from a machine one, and sharing the write path makes that
  indistinguishable at the source. Rejected deliberately; the two functions
  duplicate a little logic on purpose.
- **Auto-`completed` instead of auto-`no_show`** — optimistic and wrong: it
  would claim a service was delivered, and for cash bookings would fabricate
  revenue. `no_show` is the conservative guess; the desk can still be right
  within the grace window.

## Verified on dev (2026-07-28)

Ran the job against a seeded stale **cash** booking and a stale prepaid one:

| Booking | status    | payment_status     | payments row          | closed_by |
| ------- | --------- | ------------------ | --------------------- | --------- |
| Cash    | `no_show` | `cash` (unchanged) | `pending` (unchanged) | `system`  |
| Prepaid | `no_show` | `paid` (already)   | `completed` (already) | `system`  |

Both `no_show_at` stamped. `auto_close_stale_bookings()` is granted to
`service_role` only — `authenticated` cannot call it.

## Consequences

- `bookings.closed_by` must be carried into any P-series or A-series reporting
  that counts no-shows. A raw `status = 'no_show'` count mixes guesses with
  facts.
- Existing outcomes were backfilled to `'provider'` — every one recorded before
  this migration came from a human at a desk.
- P02's booking-detail drawer should SHOW the discriminator ("أُغلق تلقائياً")
  so the desk understands why a booking closed itself.
