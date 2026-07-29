# SPEC · P03 — Dashboard: Services & Prices Editor (Web)

> Hand this to Claude Code. Read the root docs, docs/ENGINEERING-WORKFLOW.md, PROGRESS.md
> (P02 Shipped + hand-off), the approved prices-editor design in the design/handoff/ bundle,
> and the DB contract for `branch_services` / `services` / `booking_services`. Verify against
> the live dev DB. One PR. Slot-allocation screen remains OUT of scope (P04).

---

## Goal

The branch's service list becomes provider-managed: prices editable inline with guardrails,
an honest audit trail, and the placeholder-prices launch blocker turns into a data-entry task
for partners instead of a code task for us. This is also the first screen partners will use
in anger — the empty/first-run state is an onboarding moment, per the design.

## Pre-work: verify one contract before anything (it protects money)

**Price changes must never touch existing bookings.** Read how booking totals are stored:
`booking_services` should snapshot the price at booking time (F05/F06 built totals from the
selection). PROVE with a query that a confirmed booking's line prices live on the booking's
own rows, not joined live from `branch_services`. If any read path (patient app, dashboard
drawer, SMS composition) derives a booking's amounts from live `branch_services` prices,
FIX that first in this PR — a price edit silently rewriting history on an existing booking
is a money bug. State the finding either way in the PR.

## A · Data layer

1. **`update_branch_service(p_branch_service_id, p_price_egp, p_is_active)` RPC** — the P01/P02
   DEFINER pattern: explicit grants, branch-membership check inside, validation server-side:
   price is a positive integer within sane bounds; reject absurd jumps (>10× current) with a
   schema error the UI maps (the client's type-to-confirm handles 50%+ changes as UX; the
   server cap is the real guardrail). `is_active` lets a branch pause a service (patient app
   must respect it — verify the discovery/profile queries already filter on it; if not, fix).
2. **Audit trail:** `branch_service_price_history` (or equivalent) — append a row per change:
   old/new price, changed_by (auth uid), changed_at. Small migration. This is dispute
   insurance and, later, the data behind "آخر تحديث" per row.
3. Do NOT allow adding/removing services from the catalog here — the catalog (services table)
   is admin-owned (A-series). This screen manages the branch's prices + availability of
   EXISTING linked services only. If the design shows an "add service" affordance, render it
   disabled with the design's coming-soon treatment and note it for A-series.

## B · Screen (per the approved design — build exactly)

- The branch's services grouped by category (same grouping order as mobile), each row:
  service name (AR), current price inline-editable, availability toggle, "آخر تحديث" (from
  the audit trail; absent when never edited — empty means absent), prep-note indicator
  read-only.
- Edit interaction per design: inline edit → confirm; changes ≥50% trigger the
  type-to-confirm pattern from the design (retype the new price to commit — fat-finger
  insurance on a shared desk computer).
- Optimistic UI with rollback + Arabic error mapping (bounds, membership, absurd-jump).
- First-run/empty state per the design's onboarding treatment.
- A visible, calm note when placeholder prices are detected is NOT needed — but PROGRESS's
  launch-blocker item updates from "replace placeholder prices (code)" to "partners enter
  real prices via P03 (data) — verify before launch".

## Consistency section

- Patient-side effect is immediate-on-next-fetch (TanStack staleness acceptable) — but the
  BOOKED world is immutable: the pre-work contract above is the acceptance bar.
- Toggled-off services disappear from patient discovery/selection on next fetch and cannot
  enter new bookings (server-side too: the booking-creation path must reject an inactive
  service — verify, fix if not, regression-test).
- Display predicates = enforcement predicates for the edit affordances (a non-member sees
  nothing editable AND the RPC rejects them).

## Tests

**Node-against-dev:** membership scoping (other-branch rejected), bounds + absurd-jump
rejection, audit row per change, inactive service rejected at booking creation, and the
money-contract proof (existing booking's totals unchanged after a price edit — the test
books, edits the price, re-reads the booking).
**Playwright:** inline edit happy path → "آخر تحديث" appears; ≥50% change → type-to-confirm
flow; toggle off → patient-side query (API-level check) excludes it; validation errors render
mapped Arabic.
**Manual (recorded in PR):** edit a Town price on the desk → phone shows the new price on the
branch profile on next visit → an EXISTING booking in حجوزاتي still shows its original total.

## Acceptance criteria

- [ ] Matches the approved design RTL at 1366×768 incl. first-run state and confirm pattern
- [ ] Money contract proven: price edits never alter existing bookings anywhere they render
- [ ] Audit trail live; membership + bounds enforced server-side
- [ ] Inactive services excluded from patient discovery AND rejected server-side at booking
- [ ] PROGRESS launch-blocker item updated; CI green; manual test recorded

## What NOT to do

- No catalog add/remove (A-series). No slot allocation (P04). No bulk import (later, if
  partners' price lists demand it — note as candidate). No commission display here.

## When done

PROGRESS entry + hand-off for P04 (slot allocation view — read-only receptionist +
owner-gated edit per the design; note the role question: provider_users has no role tiers
yet, which P04 must resolve or explicitly defer).
