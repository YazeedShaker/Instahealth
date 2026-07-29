# SPEC · P02 — Dashboard: Booking Detail Drawer, Cancel-on-Behalf & Upcoming Days (Web)

> Hand this to Claude Code. Read the root docs, docs/ENGINEERING-WORKFLOW.md, PROGRESS.md
> (P01 Shipped entry + hand-off: row component API, realtime setup, RPC patterns),
> docs/specs/SPEC-P01-dashboard-today-view.md (the foundation contract), and the approved
> designs in design/dashboard/ (Booking Detail drawer + Upcoming Days screens ONLY — prices
> editor and slot allocation remain out of scope). Verify against the live dev DB. One PR.

---

## Goal

Two additions to the receptionist's tool, both inheriting P01's row anatomy and data layer:
the booking detail drawer (including desk-side cancellation — phone cancellations are real
front-desk life), and the upcoming-days view so the desk can see past today.

## A · Booking detail drawer (per design)

- Opens off any row (Today or Upcoming) as a drawer/panel — never a page navigation; the
  list stays alive behind it, realtime included.
- Contents per the approved design: booking ref, full patient contact (tel: link), every
  service with price + line prep notes, consolidated prep summary (same core function,
  absent when none), payment method + state, status with the action history (the P01
  timestamps: booked → arrived → completed / no_show / cancelled, rendered as the design
  shows), and the slot's date/time.
- Same contextual outcome actions as the row (shared component/logic — one source, P01's).
- **Cancel-on-behalf**: visible per the design, allowed while the booking is cancellable
  (same predicate as the patient side: before slot start, status permitting — reuse the
  server rule; if `cancel_booking()` is patient-scoped (`not_your_booking`), add a
  provider-scoped path per the P01 RPC pattern: DEFINER + explicit branch-membership check
  inside + grants-sweep-style explicit GRANT, rather than loosening the patient function).
  Destructive confirm per design system; records WHO cancelled (persist a `cancelled_by`
  discriminator — patient|provider — if the schema lacks it, small migration; the patient's
  حجوزاتي must render a desk-cancelled booking honestly on next focus).
- Realtime: a booking cancelled/updated elsewhere while its drawer is open updates or
  gracefully closes with a toast — no stale drawer actions (display predicate = enforcement).

## B · Upcoming days (per design)

- The date-switcher pattern from the approved design over the slot window; same list/row as
  Today (literally the same component, parameterized by date), read-mostly: outcome actions
  only render for today (you can't mark tomorrow's patient arrived — enforce in the RPC too
  if it doesn't already; verify), cancel-on-behalf available per the same predicate.
- Fill indicator per selected day. Empty/loading/error states per design.
- Realtime scope: new bookings for the VIEWED day appear live (the P01 subscription is
  branch-scoped — filter client-side by the viewed date; verify the event payload suffices).

## Consistency section

- One row component, one outcome-action module, one cancellable-predicate — Today, Upcoming,
  and the drawer all consume the same sources. Zero copy-paste variants.
- Action buttons shown ≡ transitions the RPCs accept, per screen context (today vs future).
- Cancelled rows visible with cancelled styling in every view; capacity release verified
  (the freed slot must reappear patient-side — Node check).

## Tests

**Node-against-dev:** provider cancel path (own branch OK incl. capacity release +
cancelled_by=provider; other branch rejected; past-cutoff rejected; patient RPC untouched
by any changes — regression), future-day outcome marking rejected server-side.
**Playwright:** row → drawer (list stays live) → outcome progression from the drawer →
cancel-on-behalf full flow with confirm → drawer for a booking cancelled from a patient
session mid-open resolves gracefully → date switcher renders seeded future bookings →
future rows show no outcome actions.
**Manual (recorded in PR):** phone books for TOMORROW → desk switches to tomorrow, row is
there → desk cancels on behalf → patient's phone shows it cancelled on next focus → the
freed slot is bookable again from the phone.

## Acceptance criteria

- [ ] Drawer + Upcoming match the approved designs RTL at 1366×768; list stays live behind
      the drawer
- [ ] Cancel-on-behalf server-enforced (branch-scoped, time-scoped), cancelled_by recorded,
      patient side renders it correctly
- [ ] Future-day actions impossible client- AND server-side
- [ ] Manual cross-device test recorded; PROGRESS updated; CI green

## What NOT to do

- No prices editor, no slot-allocation screen (P03/P04). No reschedule-on-behalf (same
  post-MVP status as patient reschedule). No new row variants. No printing yet.

## When done

PROGRESS entry + hand-off for P03 (services & prices editor — the screen that retires the
placeholder prices; note anything about branch_services shapes it should know).
