# SPEC · F06 — Payment (Mock Provider), Confirmation & SMS (Mobile)

> Hand this to Claude Code. Read `CLAUDE.md`, `PRODUCT.md`, `PROGRESS.md` (F05 hand-off + fix
> notes), the booking-flow + confirmation design handoffs, and the migrations for `bookings`,
> `payments`, `confirm_booking()`. Requires: F05 + the post-race fix PR merged. One PR.

---

## Goal

Step 4 closes the loop: the patient "pays," `confirm_booking()` runs atomically, the approved
confirmation screen celebrates, and the confirmation SMS arrives. **Paymob is blocked on legal
papers, so this PR ships the real payment architecture with a MOCK provider inside it** — when
Paymob credentials exist, only the provider module changes. No shortcuts that bypass the real
confirm path: the mock must exercise exactly the machinery Paymob will.

## Architecture (the part that makes the mock cheap to replace)

- **Provider interface** in `packages/core`: `PaymentProvider` with `initiatePayment(booking)`
  → `{ redirect | inline }` and a server-side settlement contract. Implementations:
  `MockPaymentProvider` (this PR) and `PaymobProvider` (stub file with TODOs + the HMAC
  verification requirement documented, implemented when credentials exist).
- **Settlement is server-side only.** A Supabase Edge Function `settle-payment` plays the role
  Paymob's webhook will: it receives `{ bookingId, providerRef, outcome }`, validates the hold
  is still active and the booking pending, calls `confirm_booking()` (which increments the
  slot, confirms, inserts the payment row, deletes the hold — atomically), and triggers the
  confirmation SMS via the existing `send-sms` function. The client NEVER calls
  `confirm_booking` directly and NEVER writes payment rows. For the mock, the payment screen
  calls `settle-payment` with a mock provider ref; for Paymob later, Paymob's webhook calls it
  (with HMAC verification added at that boundary). One settlement path, two callers.
- Payment method rows on the screen per the approved design (بطاقة / فوري / محفظة فودافون)
  rendered but visibly marked "وضع تجريبي" (test mode) with a single mock "ادفع الآن" action.
  A DEV-only toggle simulates failure to exercise the failure path.

## Screens (per design handoffs)

1. **payment.tsx** — replaces the F05 stub: amount, booking recap line, method list (test-mode
   badge), pay CTA, hold timer still visible. Failure state: Arabic message, retry, hold
   permitting; hold expiry here behaves per F05 (modal → repick).
2. **Confirmation screen** — per the NEWLY approved confirmation design (created in Claude
   Design as an extension of the system — DESIGN-01's original set did not include it; do not
   start this screen before its handoff bundle exists in `design/confirmation/`): Lottie moment (this is
   one of the two sanctioned Lottie uses), booking reference (`IH-2026-XXXXX` from the DB row —
   never generated client-side), branch + slot + services recap, the consolidated preparation
   notes (same core function — a patient must see fasting instructions HERE most of all),
   add-to-calendar action, and "عرض حجوزاتي" CTA → bookings tab placeholder (F07 builds it).
   Back-navigation cannot return into the booking flow (reset the stack; booking store cleared).

## SMS

Confirmation SMS via the existing template through `send-sms`, fired by `settle-payment`
server-side. Static test numbers must NOT trigger real SMS (guard by the same test-number list;
document how). Reminder SMS remains the nightly Edge Function's job — no change.

## Consistency section (mandatory going forward)

- Display predicates = enforcement predicates: the payment screen re-checks hold validity on
  focus the same way `settle-payment` will validate it; no state shown that the DB would refuse.
- Every exit from the flow (success, failure-abandon, expiry, logout) leaves NO dangling state:
  success clears store + hold is consumed by confirm; abandon/expiry release per F05; verify
  each in tests.
- Empty means absent: no prep notes → no prep section on confirmation (regression-guard it).
- Idempotency: `settle-payment` called twice for the same booking must confirm once and return
  the confirmed state the second time (Paymob webhooks retry — build it now, test it now).

## Tests

**Unit:** provider interface conformance for the mock; settlement input validation; idempotent
double-settle; store reset on success.
**Integration (against dev):** settle → booking confirmed + payment row + hold gone +
`booked_count` incremented, all-or-nothing.
**Maestro:** full loop — select services → slot → review → pay (mock) → confirmation shows
correct ref/recap/prep → bookings CTA → back cannot re-enter flow. Failure toggle path: pay
fails → retry succeeds.
**Manual (required, recorded in PR):** two-phone race THROUGH payment on the last-unit slot —
one confirmed booking, one rejected before payment; then the winner's real-device SMS check
(your real number, Arabic confirmation SMS with prep note if applicable).

## Acceptance criteria

- [ ] Full patient loop works on device: browse → select → hold → review → mock-pay → confirmed
      booking visible in dev DB with payment row + SMS received (real-number manual test)
- [ ] `confirm_booking` reachable ONLY via `settle-payment`; client grants itself nothing
- [ ] Double-settle idempotent; failure + expiry paths exercised
- [ ] Confirmation screen matches the approved design incl. prep notes and Lottie moment
- [ ] `PaymobProvider` stub documents exactly what plugs in later (HMAC, callbacks, methods)
- [ ] PROGRESS updated: "payments are SIMULATED — Paymob integration pending legal entity"
      added to the launch-blockers list
- [ ] CI green

## What NOT to do

- No Paymob SDK/network calls yet. No real money semantics anywhere. No client-side
  confirmation writes. No receipt/invoice generation (post-MVP). No refund flows yet
  (spec'd with real Paymob).

## When done

PROGRESS.md ship entry + notes for F07 (Bookings list — consumes confirmed bookings) and for
the provider dashboard track (P-series can start: real bookings now exist to display).
