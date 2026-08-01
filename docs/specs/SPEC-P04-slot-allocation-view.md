# SPEC · P04 — Dashboard: Slot Allocation View (Web, read-only)

> Hand this to Claude Code. Read the root docs, ENGINEERING-WORKFLOW, PROGRESS (P03 Shipped +
> hand-off incl. the role-tier flag), the slot-allocation design in the handoff bundle, and
> the slots/branches contract. Requires the create_slot_hold identity fix merged first. One PR.

## Decision context (settles the P03 hand-off flag)

Allocation editing ships to NO provider role. `instahealth_slot_allocation` and the daily
time window are COMMERCIAL terms of the partner agreement — changes are an InstaHealth-admin
action (A-series) preceded by a human conversation, not a dashboard toggle. Role tiers in
`provider_users` are therefore deferred to A-series onboarding, where they're needed for real.
P04 is a read-only view for the whole branch team. If the design shows edit affordances,
render the design's gated/disabled treatment with "لتعديل عدد المواعيد تواصل مع إنستاهيلث"
(+ the support contact per design system).

## Screen (per the approved design, minus editing)

- The branch's daily slot picture: allocation (N مواعيد يومياً), the generated times for a
  selected day (same date-strip pattern), each slot's state (متاح / محجوز / معلّق-hold),
  and the fill indicator consistent with P01's definition (single source).
- A short explainer block per design: what allocation means, when slots generate (nightly,
  30-day window), and that today's untaken slots don't roll over.
- States: loading, the empty/pre-generation day, error with retry.

## Consistency section

- Slot states shown ≡ the same predicates the picker enforces (available counts holds —
  the F05-era lesson; reuse the shared derivation, zero new definitions).
- Read-only means READ-ONLY: no mutation path of any kind ships in this PR; RLS already
  scopes reads to the member's branch — verify, don't assume.

## Tests

Node: branch scoping on the reads. Playwright: renders seeded allocation + day states,
disabled-edit treatment present, explainer visible. No manual device step (web-only,
no patient-side effect).

## Acceptance criteria

- [ ] Matches the design RTL at 1366×768 with the gated-edit treatment
- [ ] Slot-state definitions shared with existing code (no parallel predicates)
- [ ] PROGRESS: role-tier deferral + admin-owned-allocation decision recorded as a
      DECISION doc in docs/decisions/; A-series hand-off notes updated
- [ ] CI green

## What NOT to do

No role columns, no edit RPCs, no allocation mutations, no owner views. No analytics beyond
the existing fill indicator.
