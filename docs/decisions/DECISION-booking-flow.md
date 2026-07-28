# DECISION — Booking Flow: Step 1 Review & Date Picker

> Product decisions for the booking flow (F05). Captured from DESIGN-01 review. Feature spec F05
> must build to these. Referenced by CLAUDE.md §11 build order and PRODUCT.md §7 booking flow.

---

## Decision 1 — Step 1 is a READ-ONLY review, not a re-selection

The patient already chose their services on the branch profile screen (F04). The booking flow must
not ask them to select again — that's redundant and implies the earlier choice didn't register.

**Booking flow step 1 = "مراجعة الطلب" (review):**

- A **read-only** summary of the selected services (each: name + price) with the total.
- The **preparation note** (expandable inline — see DECISION-provider-data-model §3a) shown here if any
  selected service requires preparation. This is a natural moment for the patient to review it.
- A small **"تعديل" (edit) link** that returns to the branch profile (F04) to change the selection —
  the escape hatch is going back, NOT editing inline in the flow.
- A **"التالي"** button to proceed to slot selection (step 2).

**Mental model this enforces:** branch profile = _choose_; booking flow = _confirm & schedule_.
Selection happens once, in one place.

**F05 acceptance criteria:**

- [ ] Step 1 shows selected services read-only with per-item price and a total.
- [ ] No checkboxes / add-remove controls in step 1.
- [ ] Preparation note (expandable inline) appears when relevant, same component as F04.
- [ ] "تعديل" returns to F04 with the current selection preserved.
- [ ] Selection state persists across F04 → flow → back to F04 (Zustand booking store).

---

## Decision 2 — Date picker: 7–14 day strip + calendar affordance, capped at the slot window

### The constraint that decides it

Slots exist only within a **30-day rolling window** (`generate_branch_slots` generates 30 days
ahead; nightly cron maintains it). There is never bookable inventory beyond ~30 days. That is the
hard ceiling for any date UI.

### The pattern (hybrid)

- **Default: a horizontal date strip showing ~7–14 days** from today. Covers the overwhelming
  majority of health bookings (people book within a week or two). Fast, mobile-native, one-handed.
  Tap a day → its available time slots load below.
- **A calendar affordance** (a small "التقويم" calendar icon at the end of the strip) opens a full
  month picker for patients who need to go further out — **capped at the 30-day window**. Dates beyond
  the window are disabled.
- **Only surface days with availability.** With the dedicated-allocation model, some days fill up (all
  InstaHealth slots taken). Fully-booked and out-of-window days appear **disabled** in BOTH the strip
  and the calendar — never let a patient tap into a day with no slots (dead end).

### Why not the alternatives

- **7-day-only strip:** too restrictive — Town Hospital doctor appointments legitimately book 2–3 weeks
  out; a hard 7-day cap blocks real demand.
- **Full calendar always:** unnecessary friction for the common case ("a lab test tomorrow morning").
  A calendar is more taps and more screen for a usually-near-term decision.
- **30-day strip:** scrolling 30 days horizontally is a poor experience. The strip should be short;
  the calendar handles reach.

### Note on the mockup

The horizontal strip "not sliding" in the Claude Design mockup is a static-preview limitation, not a
real bug. Claude Code builds it as a proper horizontally-scrollable strip. No action needed in design.

**F05 acceptance criteria:**

- [ ] Default date view is a horizontal scrollable strip of ~7–14 days from today.
- [ ] A calendar icon/affordance opens a month picker capped at the 30-day slot window.
- [ ] Days with no availability (fully booked) and days beyond the window are visibly disabled in both
      the strip and the calendar.
- [ ] Selecting a day loads only that day's available slots (respects `is_blocked` + `booked_count < capacity`).
- [ ] Selecting a slot starts the 10-minute hold with the visible countdown (existing behavior).
- [ ] Slot availability query lives in `packages/core/api`; day-availability logic is testable in core.

---

## Summary (what Claude Code builds to)

1. Booking flow **step 1 is a read-only review** (services + total + prep note + "تعديل" back-link),
   not a second selection. Selection happens once on the branch profile.
2. Date picker is a **short strip (7–14 days) with a calendar affordance**, both **capped at the
   30-day slot window**, with **unavailable days disabled** so there are no dead ends.

_Last updated: July 2026._
