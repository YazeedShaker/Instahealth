# SPEC · F05 — Slot Selection, Hold & Booking Review (Mobile)

> Hand this to Claude Code. Read `CLAUDE.md`, `PRODUCT.md`, `PROGRESS.md` (F04 hand-off notes),
> `DECISION-navigation-safe-areas.md`, the booking-flow design handoff bundle, AND the migration
> files defining `slots`, `slot_holds`, `bookings`, `create_slot_hold()`, `confirm_booking()` —
> the DB contract is the law in this feature; the app adapts to it, never the reverse.
> Requires: F04 merged. One PR.

---

## Goal

Steps 2 and 3 of the approved 4-step booking flow (الخدمات ✓ → **الموعد** → **المراجعة** → الدفع):
the patient picks a slot, the app takes a 10-minute hold, and the review screen assembles the
final booking — ending at a payment stub that F06 replaces with Paymob. This is where the slot
allocation model becomes real, including the race: two patients, one slot, exactly one winner.

## Routes

```
app/(app)/booking/
├── _layout.tsx     # step progress header per design; hold timer chip lives here (persistent)
├── slot.tsx        # step 2 — replaces F04's stub as the CTA destination
├── review.tsx      # step 3
└── payment.tsx     # step 4 — styled stub this PR ("الدفع — قريباً" + booking recap); F06 replaces
```

Guard: entering the flow without a selection in the booking store redirects to Home.

## Step 2 — Slot picker (`slot.tsx`, per design)

1. **Date strip** — horizontal days over the slot window (data-driven from actual slots, up to
   `SLOT_WINDOW_DAYS`), Arabic day labels, today first; days with zero available slots visibly
   disabled.
2. **Time grid** — the selected day's slots as chips grouped by period (صباحاً / ظهراً / مساءً),
   only `available` tappable (status via core `getSlotStatus`). Empty day state per design.
3. **On confirm** — call the `create_slot_hold` RPC exactly per its migration signature.
   - Success → store `{ holdId, expiresAt }` in the booking store, start the timer, navigate
     to review.
   - Rejection (slot just taken / any RPC error) → non-blaming Arabic message
     ("تم حجز هذا الموعد للتو — اختر موعداً آخر"), refetch slots, stay on the picker.
     **Never optimistically proceed.**

## The hold timer (flow-wide)

- Chip in the flow header on slot + review + payment screens: countdown from
  `getRemainingHoldSeconds`, calm style → amber at `isHoldExpiringSoon` (the approved
  calm→amber design state).
- Expiry while in the flow → modal ("انتهت مدة حجز الموعد") with one action: back to the slot
  picker, slots refetched, store's hold cleared. No dead ends, no crash on the payment stub.
- Leaving the flow (back out of it / switching branch) → best-effort hold release (delete own
  hold via the RLS-permitted path per schema), then clear store. If release fails, ignore —
  the cleanup cron is the safety net. App kill needs nothing: server-side expiry handles it.
- Timer must survive screen transitions within the flow (it lives in the layout, driven by
  `expiresAt` from the store — never a local component countdown).

## Step 3 — Review (`review.tsx`, per design)

Assembles: branch (name, address line), slot (Arabic date + time via core formatters),
services with prices, total (`calculateBookingTotal`), the consolidated preparation summary
(`computePreparationNotes` — same expandable pattern as F04), patient name + phone from the
profile (read-only here; editing profile is out of scope), and an optional notes field if and
only if the design shows one.

**Booking row creation:** follow the DB contract in the migrations — whatever
`confirm_booking()` expects to exist at confirmation time (a pending booking row + hold, per
the schema's design) is created here on entering/confirming review, with the exact status
enum values from the schema. Do not invent statuses or flows; if the contract is ambiguous,
read the function body and match it, and document the interpretation in the PR description.
The primary CTA ("متابعة للدفع") navigates to the payment stub carrying the pending booking.

## Core additions (unit-tested)

- `buildSlotDaySections(slots, now)` — day strip + per-day period grouping, Cairo timezone,
  disabled-day flags.
- `getHoldChipState(remainingSeconds)` — 'calm' | 'warning' | 'expired' (single source for
  the UI state, thresholds from constants).

## Tests

**Unit:** day/period grouping across midnight and month boundaries; hold chip state
transitions at exact thresholds; store transitions (hold set → expired → cleared; leave-flow
reset); review total/prep assembly from a mixed selection.
**Maestro (static test user):** F04 selection → slot picker shows real seeded slots → pick →
timer chip visible → review shows correct branch/services/slot/total/prep → متابعة → payment
stub shows recap → back out to Home → re-enter flow → old hold not reused.
**Manual acceptance (two sessions):** same slot from two logged-in sessions simultaneously —
exactly one gets the hold; the other gets the friendly rejection and refreshed slots. This
test is REQUIRED before merge; record the result in the PR.

## Acceptance criteria

- [ ] Built to the approved slot-picker + review designs, RTL, on device
- [ ] Hold created via RPC only; rejection path verified (the two-session manual test)
- [ ] Timer: persistent across the flow, calm→amber at the threshold, expiry modal returns to
      a refreshed picker, leaving the flow releases the hold (verify row gone in dev DB)
- [ ] Review numbers exactly match F04's selection (no drift between screens)
- [ ] Pending booking created per the DB contract; visible in the dev DB with the correct status
- [ ] No slot/hold/booking logic reimplemented client-side beyond display math from core
- [ ] CI fully green

## What NOT to do

- No payment integration (F06). No SMS sending. No editing services here (back to F04 does
  that — selection survives the round-trip within the same branch).
- Never trust client time for anything but display; `expiresAt` comes from the server row.
- Never bypass `create_slot_hold` with direct inserts.

## When done

Update PROGRESS.md (Shipped + the two-session test result + notes for F06: booking store
final shape, pending-booking id handoff, the stub to replace). F06 (Paymob payment +
confirmation screen + SMS) completes the patient loop.
