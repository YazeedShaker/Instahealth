# SPEC · F04 — Branch Profile & Service Selection (Mobile)

> Hand this to Claude Code. Read `CLAUDE.md`, `PRODUCT.md`, `PROGRESS.md` (F02 hand-off notes),
> `DECISION-navigation-safe-areas.md`, and the branch-profile design handoff bundle first.
> Requires: F02 merged. One PR. F03 (Search) intentionally rides after this.

---

## Goal

Tapping a provider card on Home opens the branch profile: everything a patient needs to decide
(who, where, when, what, how much) and the service-selection flow that feeds booking. The
sticky "احجز الآن" CTA with the running total is the handoff point to F05 — here it navigates
to a styled stub. This screen is the approved DESIGN-01 branch-profile mockup, built exactly.

## Route & entry

- `app/(app)/branch/[id].tsx` — deep-linkable by branch id (search results and SMS links will
  use this later). Home's provider cards (stubbed in F02) now navigate here.
- Unknown/inactive id → friendly Arabic error state with a back-to-Home action, never a crash.

## Screen structure (per the design handoff)

1. **Header** — branch name (Arabic), provider type badge, open/closed chip with today's hours
   and an expandable full-week schedule (reuse `isBranchOpenNow`), distance from the user
   (same location state as Home; hide when unknown). Actions row: **اتصال** (tel: with the
   branch phone — hotline fallback when the branch has none, e.g. Kerdasa), **الاتجاهات**
   (opens the maps app at branch lat/lng; hidden for NULL-coord branches).
2. **Next-slots preview strip** — "أقرب المواعيد": horizontal read-only chips of the next few
   available slots (from the same batched slots query shape as F02). Preview only — actual
   slot picking is F05. Empty state: "لا توجد مواعيد متاحة حالياً".
3. **Services list** — grouped by category (تحاليل / أشعة where the branch offers both), each
   row: service name (AR), price (EGP, `formatEGP`), a prep-note indicator icon where the
   service has preparation requirements, and a selection checkbox. Multi-select. A thin
   in-list search field filters services client-side (this is NOT F03's global search).
4. **Preparation summary strip** — when the current selection has prep requirements, show the
   consolidated summary from `computePreparationNotes()` (the locked longest-fast-wins copy)
   with the expand interaction from the design: tapping reveals per-service details. Appears
   once, updates live with selection, disappears when selection has no prep.
5. **Sticky bottom CTA** — "احجز الآن" with selected count + running total
   (`calculateBookingTotal`). Disabled until ≥1 service selected. Safe-area rules apply.
   Navigates to `app/(app)/booking/` styled stub ("قريباً" + selection recap) — F05 replaces it.

## State

- One Zustand **booking store**: `{ branchId, selectedServices, actions }` — created here,
  consumed by F05/F06 later. Selection resets when the user opens a DIFFERENT branch (keep
  when returning to the same one within the session). No selection state in component state.
- Data via TanStack Query: branch-by-id (join provider + services + categories), slots
  preview. Cache keys consistent with F02's so Home → profile feels instant on cached data.

## Core additions (unit-tested)

- `groupServicesByCategory(services): CategoryGroup[]` — stable ordering per design
  (labs first, then scans).
- `summarizeSelection(selected): { count, totalEgp, label }` — the CTA line ("خدمتان · ٣٥٠ ج.م")
  with correct Arabic dual/plural forms for 1/2/3–10/11+.

## Tests

**Unit:** selection store transitions (add/remove/reset-on-branch-change); CTA label plural
forms; grouping order; prep-strip presence logic against `computePreparationNotes` outputs.
**Maestro:** login → Home → tap Town Hospital → profile renders header + services →
select one fasting lab + one non-fasting → prep strip appears, mentions fasting once →
total and count correct → CTA enabled → tap → booking stub shows the same selection →
back → open a Saridar branch → previous selection is gone.

## Acceptance criteria

- [ ] Built to the approved branch-profile design, RTL, on device
- [ ] Call + directions actions work (hotline fallback verified on Kerdasa; directions hidden
      when coords NULL)
- [ ] Selection flow: live total, prep summary consolidates correctly (fasting mentioned once
      for multi-fasting selections), CTA gating right
- [ ] Deep link `instahealth://branch/<id>` opens the profile signed-in
- [ ] Unknown id, empty services, and no-slots states styled per design system
- [ ] CI fully green including Maestro

## What NOT to do

- No slot picking, holds, or payment (F05/F06). No global search (F03). No reviews/ratings
  display beyond what the design shows (reviews feature is F08). No doctors content.
- Do not duplicate business math in the app — totals, prep, plural labels all come from core.

## When done

Update PROGRESS.md (Shipped + notes for F05: booking store shape, slots query, stub route to
replace). F05 (Slot Selection & Hold) is next — it's the heart of the product, and its spec
will come with the booking-flow design handoff (the 4-step flow from DESIGN-01).
