# Design handoff — latest export

**Export date:** 2026-07-28 · **Source:** Claude Design, project "InstaHealth"

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

## Screens in this export (12)

**Patient app** — Onboarding Flow · Home Screen · Provider Profile · Booking
Flow · Booking Confirmation · My Bookings

**Provider dashboard** — Login · Today · Booking Detail · Upcoming Days ·
Prices Editor · Slot Allocation

## How to consume it

Read the `.dc.html` source, never a screenshot. But for anything that is a
design-system component (Button, StatusBadge, Card, Alert, Chip, Input…),
implement the **shared contract in `packages/design-tokens/src/components.ts`**
rather than copying pixel values out of the prototype — the prototype is one
rendering of the system, the contract is the system. Hand-copying values is how
P01's first dashboard build drifted from the design.

## Export log

| Date       | Change                                                                                                                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-28 | Consolidated to a single `design/handoff/` bundle. Replaced the split `design/mobile/` (a stale 6-screen subset) and `design/dashboard/` (the full 12-screen export) — the six shared screens were byte-identical, so nothing was lost. Adds the six Provider Dashboard screens for DESIGN-02. |
