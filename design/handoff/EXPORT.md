# Design handoff — latest export

**Export date:** 2026-08-05 · **Source:** Claude Design, project "InstaHealth"

## What this is

The **whole-project** export from Claude Design — every screen, plus the shared
design system under `project/_ds/`. There is exactly ONE bundle in this repo and
this is it.

## The rule

**Claude Design exports the whole project every time.** Splitting it into
per-surface folders (`design/mobile/`, `design/dashboard/`, …) produced
self-deceiving duplicates: the folders looked surface-specific but each held a
full copy, so an older export sat next to a newer one and a session could read
either. The `_ds` bundle in particular was byte-identical across copies.

So: **replace this folder wholesale on each export.** Never add a second bundle
beside it, never keep the old one "just in case" — git history is the archive.
Update the log below when you replace it.

Extracted or generated brand assets (logo files prepared for the apps) live in
`design/brand/`, not here — those are ours, this is Claude Design's.

## Screens in this export (23)

**Patient app (8)** — Onboarding Flow · Home Screen · Search · Provider Profile ·
Booking Flow · Booking Confirmation · My Bookings · Reviews Display Addendum

**Provider dashboard (7)** — Login · Today · Booking Detail · Upcoming Days ·
Prices Editor · Slot Allocation · Branch Details

**Admin panel (8)** — Login and TOTP · Ops Overview · Commission Statement ·
Providers and Branches · Service Catalog · Staff Accounts · Bookings Oversight ·
Analytics

⚠ Naming trap: **"Provider Profile" is the PATIENT-app branch screen** (F04 —
iOS frames, booking CTA). The dashboard's بيانات الفرع screen is
**"Provider Dashboard - Branch Details"**. P05 was first built against the
wrong assumption that no design existed; the names are why.

⚠ Second naming trap, new in this export: **the admin screens are the only ones
prefixed `Admin - `**, and "Admin - Analytics" is NOT a placeholder — it is an
APPROVED stub page (five questions + an activation note), which SPEC-A01 says
to render as designed rather than as a قيد البناء placeholder.

⚠ `README.md` in this folder is CLAUDE DESIGN'S OWN boilerplate, rewritten by
every export to point at whichever file the founder had open when they hit
handoff. This export points it at "Reviews Display Addendum", which belongs to
**F08, not A01**. It is a record of what was on screen, not an instruction —
the spec decides what gets built (workflow §1.5).

## How to consume it

Read the `.dc.html` source, never a screenshot. But for anything that is a
design-system component (Button, StatusBadge, Card, Alert, Chip, Input…),
implement the **shared contract in `packages/design-tokens/src/components.ts`**
rather than copying pixel values out of the prototype — the prototype is one
rendering of the system, the contract is the system. Hand-copying values is how
P01's first dashboard build drifted from the design.

## Export log

| Date       | Change                                                                                                                                                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-28 | Consolidated to a single `design/handoff/` bundle. Replaced the split `design/mobile/` (a stale 6-screen subset) and `design/dashboard/` (the full 12-screen export) — the six shared screens were byte-identical, so nothing was lost. Adds the six Provider Dashboard screens for DESIGN-02.                                               |
| 2026-08-04 | Whole-project re-export (founder). Adds **Provider Dashboard - Branch Details** (the P05 بيانات الفرع screen — P05's UI was rebuilt to it the same day) and **Search** (F03's screen, not yet built). Introduces the +20 national phone treatment, the card-header chips, and the saved-toast — all transcribed into the component contract. |
| 2026-08-05 | Whole-project re-export (founder) — **DESIGN-03, the admin panel**. Adds all EIGHT admin screens (Login and TOTP · Ops Overview · Commission Statement · Providers and Branches · Service Catalog · Staff Accounts · Bookings Oversight · Analytics) plus the patient-app **Reviews Display Addendum** (F08's branch-profile reviews section — designed, not yet built). 14 → 23 screens. Introduces the admin accent: a deep-ink `#023449` anchor panel and pill badge that distinguishes الإدارة from بوابة الشركاء at a glance. A01 consumes **Login and TOTP** only; the other seven are A02–A06's sources and were committed with it because the bundle is replaced WHOLESALE (§3a) — a per-screen commit would be the split-bundle mistake in a new form. |
