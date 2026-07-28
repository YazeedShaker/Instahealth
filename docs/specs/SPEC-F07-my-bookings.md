# SPEC · F07 — My Bookings: List, Detail & Cancellation (Mobile)

> Hand this to Claude Code. Read `CLAUDE.md`, `PRODUCT.md`, `docs/ENGINEERING-WORKFLOW.md`,
> `PROGRESS.md` (F06 Shipped entry + its hand-off notes and fix entries), the decision docs,
> the **My Bookings design handoff bundle**, and the DB contract for `bookings`,
> `cancel_booking()`, and payment-status semantics (F06 PR interpretation #5).
> Requires: F06 + its fix PR merged. One PR. Verify all claims against the live dev DB.

---

## Goal

The patient's record of truth: the حجوزاتي tab becomes real. List (upcoming/past per the
approved design), a booking detail screen, and cancellation — closing the last placeholder in
the patient loop (the confirmation screen's "عرض حجوزاتي" CTA finally lands somewhere honest).

## Screens (per the approved My Bookings design — build exactly)

1. **List (`(app)/bookings` tab)** — segmented per design (قادمة / سابقة). Booking card:
   branch name, date+time (Arabic formatters from core), services summary line, status chip,
   payment line (the F06 distinction MUST show: "تم الدفع" vs "الدفع عند الوصول" for cash),
   booking ref. Upcoming sorted soonest-first; past newest-first. States: loading skeletons,
   empty-upcoming (design's empty state + CTA to Home), empty-past, pull-to-refresh, and
   refetch-on-focus (a booking confirmed/cancelled elsewhere must not render stale).
2. **Detail (`(app)/bookings/[id]`)** — everything from the confirmation screen's recap
   (server-DTO lesson from F06 applies: fetch via an RLS-safe path, mind the slots-visibility
   trap — the patient CANNOT read their booked slot row; use the booking's own denormalized
   fields or a SECURITY DEFINER read per the DB contract), plus: prep notes (same expandable,
   absent when none), add-to-calendar, call branch / directions (F04's actions reused),
   and the cancel action per the rules below. Deep-linkable; unknown id → friendly error.

## Cancellation (the substantive part — get the contract right)

- Read `cancel_booking()`'s body FIRST: what statuses it accepts, whether it releases slot
  capacity (decrement `booked_count`) and how it treats the payments row. The app follows the
  function; document the interpretation in the PR.
- **Product rule (REVISED decision — supersedes any cutoff in the design or earlier drafts):**
  patient-cancellable **anytime before the slot's start time, free, no fees, for all payment
  methods**. The only server-enforced boundary is the slot start (and status: confirmed or
  pending_payment only). If `cancel_booking()` lacks the slot-start check, add it in a small
  migration (display predicate = enforcement predicate). No cancellation-fee logic anywhere.
  ⚠ The design's confirm dialog mentions "قبل الموعد بـ ٤ ساعات" — this copy is OUTDATED;
  use the revised copy ("يمكنك إلغاء الحجز مجاناً في أي وقت قبل الموعد") and flag the design
  bundle for a copy revision (do not redesign the dialog, only the line).
- **Record the data policy v2 will need:** persist `cancelled_at` (if the schema lacks it,
  add it in the same migration) so late-cancel patterns are measurable later. No user-facing
  consequence of lateness in MVP.
- Confirm dialog per design system (destructive style, "تراجع" safe default). For mock-paid
  bookings no refund language (payments simulated — real PayTabs refunds get their own spec;
  note in a code comment that prepaid cancels will mean FULL refund per the ratified policy).
- After cancel: status chip flips, slot capacity released (verify in dev DB), list moves it
  to past, and the freed slot reappears in other users' pickers (realtime broadcast if the
  hold/slot channel covers it — verify; otherwise their refetch-on-focus is acceptable, say so).
- Reminder SMS: verify `booking-reminder` excludes cancelled bookings (it should by status
  filter — prove it, don't assume).

## Consistency section

- Refetch-on-focus everywhere bookings render; no stale status anywhere in the tab.
- Display predicates = enforcement predicates (cancel button visibility ≡ server cutoff).
- Empty means absent (no prep → no prep section in detail).
- Every list state reachable in tests: empty/one/many, cash vs paid, cancelled styling.

## Core additions (unit-tested)

- `isCancellable(booking, now)` — status + before-slot-start only (no cutoff), `now` injected,
  Cairo timezone.
- `partitionBookings(bookings, now)` — upcoming/past split incl. edge cases (today's past
  slot goes to past; cancelled goes to past regardless of date).
- `getBookingStatusChip(booking)` — single source for chip label/variant incl. the cash
  distinction and cancelled.

## Tests

**Unit:** the three core functions across boundaries (cutoff exactly 2h, midnight, cancelled
future booking partitions to past).
**Node-against-dev (F06 pattern, both test users):** cancel happy path (capacity released,
status flipped), cancel past-cutoff rejected server-side, cancel someone else's booking
rejected, double-cancel idempotent-or-clean-error.
**Maestro:** book (mock pay) → confirmation CTA → list shows it under قادمة with correct
payment line → open detail → prep notes present for fasting selection → cancel → confirm
dialog → moves to سابقة as ملغي → slot visible again in the picker.

## Acceptance criteria

- [ ] List + detail match the approved design RTL on device; all states styled
- [ ] Confirmation "عرض حجوزاتي" lands on the real list showing the just-made booking
- [ ] Cancellation enforced server-side at the cutoff; capacity provably released
- [ ] Cash vs paid rendering correct everywhere a booking appears
- [ ] No stale statuses after background/foreground or elsewhere-cancel
- [ ] PROGRESS updated; CI green

## What NOT to do

- No reschedule flow (post-MVP — cancel + rebook is the MVP answer; don't build half of it).
- No refund logic. No reviews prompt (F08). No provider-side anything.
- No new list designs — the approved bundle is the contract.

## When done

PROGRESS entry + hand-off notes for P01 (statuses/payment semantics the dashboard must
mirror, incl. cancelled and cash-pending) — P-series becomes the critical path next.
Record two OPEN business decisions for the founders in PROGRESS: (1) the P-series needs a
receptionist-marked outcome (`no_show` / completed) — check whether the status enum supports
it and note the migration if not; (2) commission-attachment event: at payment for prepaid,
at completion for cash (recommended, pending founder ratification) — this shapes P-series
reporting and partner invoicing.
