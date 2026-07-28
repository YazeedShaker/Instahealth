# DECISION — Provider Data Model & Service Display

> Cross-cutting product + data decisions for how providers, their services, categories, and
> preparation notes work. Captured so they're not rediscovered later. Feature specs (F04, F05,
> P04, A02, A03) must build to these rules. Referenced by CLAUDE.md §6.

---

## Context

Two launch partners expose the shape of this problem:

- **Saridar Labs** — primarily lab tests today, but may add scans / home collection later.
- **Town Hospital** — genuinely multi-category from day one: labs + scans + doctor consultations.

Town Hospital alone forces the branch profile to be multi-category immediately. This is not a
hypothetical future case — it's a launch requirement.

---

## Decision 1 — A branch can offer services across multiple categories

The schema already supports this and we rely on it:
`provider → branches → branch_services → services → service_categories`.

Nothing forces a branch to be single-category. A branch's service menu may span labs, scans, home
visits, etc. **We build the branch profile to render services GROUPED BY CATEGORY**, with a section
header per category (تحاليل / أشعة / كشف طبيب…), even when a branch only has one group at launch.

**Why:** designing a flat single-category list means rebuilding the screen the moment a provider
adds a second category. Town Hospital needs grouping on day one. Group from the start.

---

## Decision 2 — Onboard the FULL menu, surface only ACTIVE categories

The `service_categories.is_active` flag is the control dial (seed data ships with only `labs`
active; scans/doctors/etc. inactive).

**The rule:**

- Onboard a provider's **complete** service menu into the database, even categories we haven't
  launched. Data is complete and launch-ready.
- **Only show and allow booking of services whose category `is_active = true`.** A branch may have
  home-visit services in the DB, but if `home-visits` is inactive, patients never see or book them.
- **Launching a new category = flipping one `is_active` flag.** Every provider's services in that
  category light up at once. No data migration, no per-provider work.

**Why:** surfacing a category we can't reliably fulfill (unvalidated flow, unproven operations) is
how trust breaks on booking #1. The dial lets ops readiness — not data availability — gate what's
bookable. For MVP the active set is: **labs, scans, doctor appointments.**

**Implications for specs:**

- **F04 (branch profile):** query groups services by category; filter to `is_active` categories only.
- **A03 (admin service catalog):** admin can toggle category `is_active` — this is the launch switch.
- **A02 (provider onboarding):** onboarding captures the full menu regardless of active state.
- **P04 (provider services):** providers manage their full menu; inactive-category items show a
  "coming soon / not yet live on InstaHealth" state, not a broken one.

---

## Decision 3 — Preparation notes are PER-SERVICE and computed from SELECTION

The current design mockup showed a single blanket preparation note at the top of the branch profile.
**That is incorrect.** Preparation is a property of each service, not the branch.

The schema is already correct: each `services` row has its own `preparation_notes_ar` /
`preparation_notes_en` (e.g. CBC = "لا يشترط صيام"; lipid panel = "صيام كامل 12 ساعة"). Only the
display logic needs to follow the data.

**The rule:**

- **No blanket branch-level preparation note.**
- As the patient selects services, collect the prep notes of **only the selected** services.
- Show a consolidated preparation callout (cream accent) reflecting the actual selection. Omit
  services that need no preparation.
- **Fasting consolidation:** when multiple selected services require fasting, show the **longest**
  fast once ("صيام 12 ساعة") rather than repeating per test. Merge duplicate/overlapping notes.
- If no selected service needs preparation, show **no** callout at all.
- The computed note appears in three places (already planned): at selection, on the confirmation
  screen, and in the reminder SMS.

**Implications for specs:**

- **F04 / F05:** a pure function in `packages/core/business` — e.g.
  `computePreparationNotes(selectedServices): PreparationNote[]` — deduplicates, consolidates fasting
  to the longest duration, and returns the notes to display. Unit-tested (this is exactly the kind of
  business logic that lives in core and gets tested thoroughly).
- The booking confirmation and reminder SMS reuse the same function — one source of truth.

---

## Summary (what Claude Code builds to)

1. Branch profile renders services **grouped by category** with section headers — multi-category ready.
2. Only **active** categories are shown/bookable; the full menu lives in the DB regardless.
   Launching a category = toggling `is_active`.
3. Preparation notes are **per-service**, **computed from the current selection**, consolidated
   (longest fast wins, duplicates merged), shown only when relevant, via a shared core function
   reused at selection, confirmation, and SMS.

_Last updated: July 2026._
